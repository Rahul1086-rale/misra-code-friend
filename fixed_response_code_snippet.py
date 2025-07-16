import re
import json

# response_txt = r"""
# ```cpp
# 93: #define BRG_COND(A,B,C,D,E,F,G,H,I,J)       \
# 94:     ((static_cast<uint32>(A)<<18U)|(static_cast<uint32>(B)<<16U)|(static_cast<uint32>(C)<<14U)|(static_cast<uint32>(D)<<12U)|(static_cast<uint32>(E)<<10U)|\
# 95:      (static_cast<uint32>(F)<<8U)|(static_cast<uint32>(G)<<6U)|(static_cast<uint32>(H)<<4U)|(static_cast<uint32>(I)<<2U)|(static_cast<uint32>(J)<<0U))
# 96:
# 97: #define     IS_BRIDGE(X)    (((DONTCARE&X)==DONTCARE)?0:X)
# 98: #define     GET_BRG_1(X)    ((X>>18U)&0x3)
# 99: #define     GET_BRG_2(X)    ((X>>16U)&0x3)
# 100: #define    GET_BRG_3(X)    ((X>>14U)&0x3)
# 101: #define    GET_BRG_4(X)    ((X>>12U)&0x3)
# 102: #define    GET_BRG_5(X)    ((X>>10U)&0x3)
# 103: #define    GET_BRG_6(X)    ((X>>8U)&0x3)
# 104: #define    GET_BRG_7(X)    ((X>>6U)&0x3)
# 105: #define    GET_BRG_8(X)    ((X>>4U)&0x3)
# 106: #define    GET_BRG_9(X)    ((X>>2U)&0x3)
# 107: #define    GET_BRG_A(X)    ((X>>0U)&0x3)
# ```
# """

response_txt = r"""
```c++
93: #define BRG_COND(A,B,C,D,E,F,G,H,I,J)       \
94:     ((((static_cast<uint32>(A) << 7) << 7) << 4) | /* (2*9) = 18 */ \
94a:     (((static_cast<uint32>(B) << 7) << 7) << 2) | /* (2*8) = 16 */ \
94b:     (((static_cast<uint32>(C) << 7) << 7)) |     /* (2*7) = 14 */ \
94c:     (((static_cast<uint32>(D) << 7) << 5)) |     /* (2*6) = 12 */ \
94d:     (((static_cast<uint32>(E) << 7) << 3)) |     /* (2*5) = 10 */ \
95:      (((static_cast<uint32>(F) << 7) << 1)) |     /* (2*4) = 8 */  \
95a:     (static_cast<uint32>(G) << (2*3)) |          /* (2*3) = 6 */ \
95b:     (static_cast<uint32>(H) << (2*2)) |          /* (2*2) = 4 */ \
95c:     (static_cast<uint32>(I) << (2*1)) |          /* (2*1) = 2 */ \
95d:     (static_cast<uint32>(J) << (2*0)))           /* (2*0) = 0 */
```
```c++
643:                            if(IS_BRIDGE(GET_BRG_9(Cond)))
644:                            {
644a:                                   ErrrHdlr::PutError( DOOR_BRIDGED_9, DOOR_BRIDGED_9_MSG);
644b:                                   result |= (1UL<<8);
645:                            }
646:
647:                            if(IS_BRIDGE(GET_BRG_A(Cond)))
648:                            {
649:                                    ErrrHdlr::PutError( DOOR_BRIDGED_10, DOOR_BRIDGED_10_MSG);
650:                                    isHallDoorBridged = TRUE;
651:                                    result |= (1UL<<9);
652:                            }
```
"""

def extract_snippets_from_response(response_text):
    """
    Parses Gemini-style C++ response text and extracts line-numbered code,
    preserving backslashes and formatting. Returns a dictionary.
    """
    # Match all ```cpp ... ``` blocks (non-greedy)
    code_blocks = re.findall(r"```(?:cpp|c\+\+)?\s*\n(.*?)```", response_text, re.DOTALL)
    
    all_lines = {}

    for block in code_blocks:
        lines = block.strip().splitlines()
        for line in lines:
            match = re.match(r"^(\d+[a-zA-Z]*):(.*)$", line)
            if match:
                lineno = match.group(1).strip()
                code = match.group(2).rstrip()  # Do NOT strip backslashes
                all_lines[lineno] = code
            else:
                print(f"⚠️ Skipping: {line}")
    
    return all_lines


def save_snippets_to_json(snippets, filepath="temp_snippets2.json"):
    with open(filepath, "w") as f:
        json.dump(snippets, f, indent=2)


def parse_fixed_code_blocks(gemini_response: str):
    """
    Parses Gemini's response to extract fixed C++ code snippets.
    Each snippet must have line numbers like: 123: or 123a:
    Returns a list of lists, where each list is a block of fixed lines.
    """
    fixed_blocks = []
    current_block = []

    # Remove markdown code block fences like ```c++ or ``` etc.
    lines = gemini_response.strip().splitlines()
    inside_code_block = False

    for raw_line in lines:
        line = raw_line.strip()

        if line.startswith("```"):
            inside_code_block = not inside_code_block
            continue  # Skip the ``` lines

        if not inside_code_block:
            continue  # Ignore non-code lines

        # If this line starts with a line number (e.g., 123: or 123a:), accept it
        if re.match(r'^\d+[a-z]*\:', line):
            current_block.append(line)
        elif current_block and line == "":
            fixed_blocks.append(current_block)
            current_block = []

    if current_block:
        fixed_blocks.append(current_block)

    return fixed_blocks


def debug_parse_gemini_response():
    # Sample Gemini response (multi-line string)
    gemini_response = """
```c++
93: #define BRG_COND(A,B,C,D,E,F,G,H,I,J)       \
94:     ((((static_cast<uint32>(A) << 7) << 7) << 4) | /* (2*9) = 18 */ \
94a:     (((static_cast<uint32>(B) << 7) << 7) << 2) | /* (2*8) = 16 */ \
94b:     (((static_cast<uint32>(C) << 7) << 7)) |     /* (2*7) = 14 */ \
94c:     (((static_cast<uint32>(D) << 7) << 5)) |     /* (2*6) = 12 */ \
94d:     (((static_cast<uint32>(E) << 7) << 3)) |     /* (2*5) = 10 */ \
95:      (((static_cast<uint32>(F) << 7) << 1)) |     /* (2*4) = 8 */  \
95a:     (static_cast<uint32>(G) << (2*3)) |          /* (2*3) = 6 */ \
95b:     (static_cast<uint32>(H) << (2*2)) |          /* (2*2) = 4 */ \
95c:     (static_cast<uint32>(I) << (2*1)) |          /* (2*1) = 2 */ \
95d:     (static_cast<uint32>(J) << (2*0)))           /* (2*0) = 0 */
```
```c++
643:                            if(IS_BRIDGE(GET_BRG_9(Cond)))
644:                            {
644a:                                   ErrrHdlr::PutError( DOOR_BRIDGED_9, DOOR_BRIDGED_9_MSG);
644b:                                   result |= (1UL<<8);
645:                            }
646:
647:                            if(IS_BRIDGE(GET_BRG_A(Cond)))
648:                            {
649:                                    ErrrHdlr::PutError( DOOR_BRIDGED_10, DOOR_BRIDGED_10_MSG);
650:                                    isHallDoorBridged = TRUE;
651:                                    result |= (1UL<<9);
652:                            }
```
    """
    print("=== DEBUG: PARSING GEMINI RESPONSE ===\n")

    blocks = parse_fixed_code_blocks(gemini_response)

    print(f"Total fixed blocks found: {len(blocks)}\n")

    for i, block in enumerate(blocks):
        print(f"--- FIXED SNIPPET BLOCK {i+1} ---")
        for line in block:
            print(line)
        print()


if __name__ == "__main__":
    # debug_parse_gemini_response()
    print(response_txt)
    parsed_txt_from_response = extract_snippets_from_response(response_txt)
    print(parsed_txt_from_response)
    save_snippets_to_json(parsed_txt_from_response)

