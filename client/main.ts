import {
  establishConnection,
  establishPayer,
  checkProgram,
  writeData,
  reportData,
} from './data_test';

async function main() {
  console.log("Let's say hello to a Solana account...");

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  // Write data to an account
  await writeData();

  // Find out what data the account has
  await reportData();
  console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
