import re

with open('src/content/blog/pg-isolation-locking.md', 'r') as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    div_opens = [m.start() for m in re.finditer(r'<div\b', line)]
    div_closes = [m.start() for m in re.finditer(r'</div\b', line)]
    
    for _ in div_opens:
        stack.append(i + 1)
    for _ in div_closes:
        if stack:
            popped = stack.pop()
        else:
            print(f"Extra </div> at line {i + 1}")

print(f"Remaining open divs: {len(stack)}")
