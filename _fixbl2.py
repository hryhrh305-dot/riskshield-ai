path = r"D:\ai-saas-mvp\src\lib\blacklist.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove the loadCache() and setInterval at end
content = content.replace('''
loadCache();
setInterval(loadCache, CACHE_TTL);''', '')

# Make loadCache lazy (called on first checkBlacklist)
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Removed startup cache load")
