use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use borsh::{BorshDeserialize, BorshSerialize};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct TargetAccount {
    pub mentor_counter: u32,
    pub mentee_counter: u32,
}

entrypoint!(process_instruction);
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!(
        "process_instruction: {}: {} accounts, data={:?}",
        program_id,
        accounts.len(),
        instruction_data
    );

    let accounts_iter = &mut accounts.iter();
    let account = next_account_info(accounts_iter)?;

    if account.owner != program_id {
        msg!("Incorrect account owner (must be this program)");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Increment and store the number of times the account has been greeted
    let mut target_account = TargetAccount::try_from_slice(&account.data.borrow())?;

    match instruction_data[0] {
        0 => target_account.mentor_counter += 1,
        1 => target_account.mentee_counter += 1,
        _ => {msg!("Invalid role"); return Err(ProgramError::InvalidInstructionData)}
    }
   
    target_account.serialize(&mut &mut account.data.borrow_mut()[..])?;

    msg!("Done");

    Ok(())
}
