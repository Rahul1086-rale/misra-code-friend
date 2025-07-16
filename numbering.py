def add_line_numbers(input_file, output_file):
    with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
        for i, line in enumerate(infile, start=1):
            outfile.write(f"{i}: {line}")

# Example usage
add_line_numbers('diaghdlr.cpp', 'numbered_diaghdlr.cpp')
