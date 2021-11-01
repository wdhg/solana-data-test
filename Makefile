.PHONY: deploy

output_dir = dist
program_file = $(output_dir)/solana_data_test.so

$(program_file):
	rm -rf $(output_dir)
	cargo build-bpf --manifest-path=./program/Cargo.toml --bpf-out-dir=dist

deploy: $(program_file)
	solana program deploy $(program_file)
