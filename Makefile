.PHONY: clean deploy

output_dir = dist
program_file = $(output_dir)/solana_data_test.so

clean:
	rm -rf $(output_dir)

$(program_file):
	cargo build-bpf --manifest-path=./program/Cargo.toml --bpf-out-dir=$(output_dir)

deploy: $(program_file)
	solana program deploy $(program_file)
