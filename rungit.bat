@echo off
cd /d c:\Users\wadii\Desktop\REZA
git add -A >> c:\Users\wadii\Desktop\REZA\gitlog.txt 2>&1
git commit -m "fix" >> c:\Users\wadii\Desktop\REZA\gitlog.txt 2>&1
git fetch origin >> c:\Users\wadii\Desktop\REZA\gitlog.txt 2>&1
git log --oneline -8 >> c:\Users\wadii\Desktop\REZA\gitlog.txt 2>&1
git log --oneline origin/main -3 >> c:\Users\wadii\Desktop\REZA\gitlog.txt 2>&1
git diff --name-only main origin/main >> c:\Users\wadii\Desktop\REZA\gitlog.txt 2>&1
echo ---DONE--- >> c:\Users\wadii\Desktop\REZA\gitlog.txt
