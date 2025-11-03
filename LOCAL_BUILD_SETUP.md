# Local Android Build Setup Guide

This guide explains how to set up your local environment to build Android AAB files using EAS CLI on Windows with WSL (Windows Subsystem for Linux).

## Prerequisites

- Windows 10/11 with WSL 2 installed
- Ubuntu (or another Linux distribution) in WSL

## Step 1: Install WSL 2 (if not already installed)

### Enable Required Windows Features

Run PowerShell as Administrator:

```powershell
# Enable WSL feature
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart your computer
Restart-Computer
```

After restart:

```powershell
# Set WSL 2 as default version
wsl --set-default-version 2

# Install Ubuntu (if not already installed)
wsl --install -d Ubuntu
```

### Verify WSL Installation

```bash
wsl --status
# Should show: Default Version: 2
```

## Step 2: Install Node.js in WSL

Open your WSL terminal (Ubuntu) and run:

```bash
# Update package list
sudo apt update

# Install Node.js (via NodeSource repository - recommended for latest LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Configure npm Global Directory (Avoid Permission Issues)

```bash
# Create a directory for global npm packages
mkdir ~/.npm-global

# Configure npm to use this directory
npm config set prefix '~/.npm-global'

# Add this directory to your PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

# Reload your shell configuration
source ~/.bashrc

# Verify the path is set
echo $PATH
```

### Install EAS CLI

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Verify installation
eas --version
```

## Step 3: Install Java JDK 17

Android builds require Java 17 (not Java 21). Install it:

```bash
# Update package list
sudo apt update

# Install OpenJDK 17
sudo apt install -y openjdk-17-jdk

# Verify installation
java -version
javac -version

# Set Java 17 as default
sudo update-alternatives --config java
# Select Java 17 option when prompted

# Find Java installation path
update-alternatives --list java
# Output will show something like: /usr/lib/jvm/java-17-openjdk-amd64/bin/java

# Set JAVA_HOME environment variable
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Add to ~/.bashrc so it persists
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc

# Reload shell configuration
source ~/.bashrc

# Verify JAVA_HOME is set
echo $JAVA_HOME
java -version
```

**Important**: Make sure `java -version` shows Java 17, not Java 21. If you see Java 21, use `update-alternatives --config java` to switch to Java 17.

## Step 4: Install Android SDK

### Install Android Command Line Tools

```bash
# Create directory for Android SDK
mkdir -p ~/Android/Sdk
cd ~/Android/Sdk

# Download command line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip

# Extract
unzip commandlinetools-linux-9477386_latest.zip

# Create proper directory structure
mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Set ANDROID_HOME environment variable
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools

# Add to ~/.bashrc so it persists
echo 'export ANDROID_HOME=~/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/tools' >> ~/.bashrc

# Reload shell configuration
source ~/.bashrc

# Accept licenses and install required SDK components
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Verify installation
echo $ANDROID_HOME
adb version
```

## Step 5: Configure EAS

### Update eas.json

Make sure your `eas.json` includes the `appVersionSource` field:

```json
{
  "cli": {
    "version": ">= 5.9.0",
    "appVersionSource": "local"
  },
  "build": {
    "internal": {
      "android": {
        "buildType": "app-bundle"
      },
      "distribution": "internal"
    }
  }
}
```

## Step 6: Verify All Installations

Before building, verify everything is set up correctly:

```bash
# Check Node.js
node --version
npm --version

# Check EAS CLI
eas --version

# Check Java (should be 17)
java -version
echo $JAVA_HOME

# Check Android SDK
echo $ANDROID_HOME
adb version
```

## Step 7: Run Local Build

Navigate to your project directory and run the build:

```bash
# Navigate to your project (adjust path if needed)
cd /mnt/d/yash/git_projects/todo-hierarchy-app

# Run local build with output directory
eas build --platform android --profile internal --local --output ./builds
```

### Build Command Options

- `--platform android`: Build for Android
- `--profile internal`: Use the "internal" build profile (defined in `eas.json`)
- `--local`: Build locally instead of on EAS servers
- `--output ./build-output`: Specify output directory for the AAB file

The AAB file will be saved in the `./build-output` directory.

## Troubleshooting

### Error: "JAVA_HOME is not set"

- Make sure Java 17 is installed: `sudo apt install -y openjdk-17-jdk`
- Set JAVA_HOME: `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64`
- Add to ~/.bashrc and reload: `source ~/.bashrc`

### Error: "Unsupported class file major version 69"

- This means Java 21 is being used instead of Java 17
- Switch to Java 17: `sudo update-alternatives --config java`
- Select Java 17 option

### Error: "SDK location not found"

- Make sure ANDROID_HOME is set: `export ANDROID_HOME=~/Android/Sdk`
- Verify SDK installation: `echo $ANDROID_HOME`
- Install SDK components: `sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"`

### Error: "node: not found"

- Install Node.js in WSL (not just Windows)
- Follow Step 2 above

### Error: "permission denied" when installing npm packages

- Use the npm global directory configuration from Step 2
- Or use `npx` instead of global installs

## Quick Reference

### Environment Variables Checklist

Add these to your `~/.bashrc`:

```bash
# Node.js
export PATH=~/.npm-global/bin:$PATH

# Java
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# Android SDK
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

After adding, reload:

```bash
source ~/.bashrc
```

### Build Commands

```bash
# Local build with output
eas build --platform android --profile internal --local --output ./builds

# Local build without output flag (default location)
eas build --platform android --profile internal --local

# Cloud build (no local setup needed)
eas build --platform android --profile internal
```

## Notes

- Local builds are faster for subsequent builds (Gradle cache)
- Cloud builds don't require local Android SDK setup
- First local build will take longer as it downloads dependencies
- Make sure you have enough disk space (~10GB recommended for SDK)
