import re
import sys

def remove_line_numbers(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as infile, open(output_file, 'w', encoding='utf-8') as outfile:
        for line in infile:
            # Match line numbers like 123:, 123a:, 45b:, etc.
            new_line = re.sub(r'^\d+[a-zA-Z]*:\s?', '', line)
            outfile.write(new_line)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python denumbering.py <input_file> <output_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    remove_line_numbers(input_file, output_file)
    print(f"Denumbered file created: {output_file}")