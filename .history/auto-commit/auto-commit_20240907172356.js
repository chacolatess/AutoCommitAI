#!/usr/bin/env node

const simpleGit = require('simple-git');
const inquirer = require('inquirer');
const axios = require('axios');
const git = simpleGit();
const { exec } = require('child_process');
require('dotenv').config(); // For handling environment variables

const COHERE_API_URL = 'https://api.cohere.ai/generate';
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// Define specific folders to monitor
const FOLDERS_TO_MONITOR = ['src', 'lib', 'components'];

async function runGitCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function generateCommitMessage(changes) {
  try {
    const response = await axios.post(COHERE_API_URL, {
      prompt: `Generate a meaningful Git commit message for the following changes:\n\n${changes}`,
      max_tokens: 50,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`
      }
    });

    return response.data.generated_text.trim() || "Auto-generated commit message.";
  } catch (error) {
    console.error('Error generating commit message:', error);
    return "Auto-generated commit message.";
  }
}

async function getModifiedFolders() {
  const status = await git.status();
  const modifiedFolders = new Set();

  status.files.forEach(file => {
    FOLDERS_TO_MONITOR.forEach(folder => {
      if (file.path.startsWith(folder)) {
        modifiedFolders.add(folder);
      }
    });
  });

  return Array.from(modifiedFolders);
}

async function autoCommit() {
  try {
    const modifiedFolders = await getModifiedFolders();

    if (modifiedFolders.length === 0) {
      console.log('No changes detected in monitored folders.');
      return;
    }

    for (const folder of modifiedFolders) {
      console.log(`Processing folder: ${folder}`);
      console.log(`Staging changes in ${folder}...`);
      await runGitCommand(`cd ${folder} && git add .`);

      const status = await git.status();
      const changes = status.files.map(file => `${file.path} - ${file.working_dir}`).join('\n');
      const commitMessage = await generateCommitMessage(changes);
      console.log(`Committing changes with message: "${commitMessage}"`);
      await runGitCommand(`cd ${folder} && git commit -m "${commitMessage}"`);
    }

    console.log('Pushing changes...');
    await runGitCommand('git push origin main');
    console.log('Changes pushed successfully.');
  } catch (error) {
    console.error('Error:', error);
  }
}

autoCommit();
