import sys

def add_line_numbers(input_file, output_file):
    with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
        for i, line in enumerate(infile, start=1):
            outfile.write(f"{i}: {line}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python numbering.py <input_file> <output_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    add_line_numbers(input_file, output_file)
    print(f"Numbered file created: {output_file}")