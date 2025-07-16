import re

def remove_line_numbers(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as infile, open(output_file, 'w', encoding='utf-8') as outfile:
        for line in infile:
            # Match line numbers like 123:, 123a:, 45b:, etc.
            new_line = re.sub(r'^\d+[a-zA-Z]*:\s?', '', line)
            outfile.write(new_line)

# Example usage
remove_line_numbers('numbered_safemondoor_FIXED_MERGED2.cpp', 'denumbered_safemondoor_FIXED_MERGED2.cpp')
