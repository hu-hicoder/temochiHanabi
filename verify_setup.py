#!/usr/bin/env python3
"""
Quick test script to validate the Sparkler Game setup
Run this to verify all components are working correctly
"""

import os
import sys

def check_file(filepath):
    """Check if a file exists"""
    exists = os.path.exists(filepath)
    status = "✓" if exists else "✗"
    print(f"{status} {filepath}")
    return exists

def check_directory(dirpath):
    """Check if a directory exists"""
    exists = os.path.isdir(dirpath)
    status = "✓" if exists else "✗"
    print(f"{status} {dirpath}/")
    return exists

def main():
    print("=" * 60)
    print("線香花火ゲーム - セットアップ確認")
    print("=" * 60)
    print()
    
    # Check directory structure
    print("📁 ディレクトリ構造:")
    dirs_ok = all([
        check_directory("templates"),
        check_directory("static"),
    ])
    print()
    
    # Check Python backend files
    print("🐍 バックエンドファイル:")
    backend_ok = all([
        check_file("server.py"),
        check_file("game_state.py"),
        check_file("requirements.txt"),
    ])
    print()
    
    # Check templates
    print("📄 テンプレート:")
    templates_ok = all([
        check_file("templates/host.html"),
        check_file("templates/play.html"),
    ])
    print()
    
    # Check static files
    print("🎨 静的ファイル:")
    static_ok = all([
        check_file("static/styles.css"),
        check_file("static/host.js"),
        check_file("static/player.js"),
        check_file("static/sparkler.js"),
    ])
    print()
    
    # Check documentation
    print("📚 ドキュメント:")
    docs_ok = all([
        check_file("README.md"),
    ])
    print()
    
    # Summary
    print("=" * 60)
    if dirs_ok and backend_ok and templates_ok and static_ok and docs_ok:
        print("✓ セットアップ完了！")
        print()
        print("次のステップ:")
        print("1. 依存関係をインストール:")
        print("   pip install -r requirements.txt")
        print()
        print("2. サーバーを起動:")
        print("   python server.py")
        print()
        print("3. ホスト画面を開く:")
        print("   http://localhost:5000/host")
        print()
        print("4. QRコードをスキャンして参加!")
    else:
        print("✗ セットアップが不完全です")
        print("不足しているファイルを確認してください")
        sys.exit(1)
    print("=" * 60)

if __name__ == "__main__":
    main()
