/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import {getPayer, getRpcUrl, createKeypairFromFile} from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are writing data to
 */
let targetPubkey: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../dist');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'solana_data_test.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/helloworld.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'solana_data_test-keypair.json');

/**
 * The state of a target account managed by the program
 */
class TargetAccount {
  data = [];
  constructor(fields: {data: number[]} | undefined = undefined) {
    if (fields) {
      this.data = fields.data;
    }
  }
}

/**
 * Borsh schema definition for greeting accounts
 */
const TargetSchema = new Map([
  [TargetAccount, {kind: 'struct', fields: [['data', '[u32; 4]']]}],
]);

/**
 * The expected size of each target account.
 */
const TARGET_SIZE = borsh.serialize(
  TargetSchema,
  new TargetAccount(),
).length;

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    fees += await connection.getMinimumBalanceForRentExemption(TARGET_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/helloworld.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/helloworld.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address (public key) of a target account from the program so that it's easy to find later.
  const TARGETING_SEED = 'target';
  targetPubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    TARGETING_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const targetedAccount = await connection.getAccountInfo(targetPubkey);
  if (targetedAccount === null) {
    console.log(
      'Creating account',
      targetPubkey.toBase58(),
      'to say write to',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      TARGET_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: TARGETING_SEED,
        newAccountPubkey: targetPubkey,
        lamports,
        space: TARGET_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}

/**
 * Write Data
 */
export async function writeData(): Promise<void> {
  console.log('Writing to', targetPubkey.toBase58());
  const instruction = new TransactionInstruction({
    keys: [{pubkey: targetPubkey, isSigner: false, isWritable: true}],
    programId,
    data: Buffer.alloc(0), // All data is [1,2,3,4]
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );
}

/**
 * Report the number of times the target account has been written to
 */
export async function reportData(): Promise<void> {
  const accountInfo = await connection.getAccountInfo(targetPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the target account';
  }
  const target = borsh.deserialize(
    TargetSchema,
    TargetAccount,
    accountInfo.data,
  );
  console.log(
    targetPubkey.toBase58(),
    'has been written to ',
    target.counter,
    ' time(s)',
  );
}
