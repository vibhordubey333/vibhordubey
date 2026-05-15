import re

with open('src/content/blog/pg-isolation-locking.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Astro's markdown parser (remark) will parse HTML tags that are indented by 4 spaces as code blocks instead of HTML.
# We need to remove the leading indentation from the raw HTML we injected.

# Split frontmatter from body
parts = content.split('---', 2)
if len(parts) >= 3:
    frontmatter = '---' + parts[1] + '---'
    body = parts[2]
else:
    frontmatter = ''
    body = content

# Remove up to 4 spaces of leading indentation from every line in the body
lines = body.split('\n')
fixed_lines = []
for line in lines:
    # If the line starts with spaces, remove up to 4 of them
    match = re.match(r'^( {1,4})(.*)', line)
    if match:
        fixed_lines.append(match.group(2))
    else:
        fixed_lines.append(line)

fixed_body = '\n'.join(fixed_lines)

with open('src/content/blog/pg-isolation-locking.md', 'w', encoding='utf-8') as f:
    f.write(frontmatter + fixed_body)

print("Indentation fixed.")
