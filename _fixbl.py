path = r"D:\ai-saas-mvp\src\lib\blacklist.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix hit_count type issues
content = content.replace(
    "(cached.hit_count || 0) + 1",
    "(Number(cached.hit_count) || 0) + 1"
)
content = content.replace(
    "(existing.hit_count || 0) + 1",
    "(Number(existing.hit_count) || 0) + 1"
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed")
