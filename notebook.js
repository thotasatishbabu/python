// GitHub configuration
const GITHUB_OWNER = 'your-github-username';
const GITHUB_REPO = 'your-repo-name';
const GITHUB_BRANCH = 'main';
const NOTES_FOLDER = 'notes';

// DOM elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const usernameSpan = document.getElementById('username');
const noteList = document.getElementById('noteList');
const newNoteBtn = document.getElementById('newNoteBtn');
const noteSelector = document.getElementById('noteSelector');
const markdownEditor = document.getElementById('markdownEditor');
const preview = document.getElementById('preview');
const saveBtn = document.getElementById('saveBtn');

// State
let currentNote = null;
let githubToken = null;
let user = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    loginBtn.addEventListener('click', authenticateWithGitHub);
    logoutBtn.addEventListener('click', logout);
    newNoteBtn.addEventListener('click', createNewNote);
    markdownEditor.addEventListener('input', updatePreview);
    saveBtn.addEventListener('click', saveNote);
    noteSelector.addEventListener('change', loadSelectedNote);
}

// GitHub OAuth (simplified - for production use proper OAuth flow)
function authenticateWithGitHub() {
    const token = prompt('Enter your GitHub Personal Access Token (with repo scope):');
    if (token) {
        githubToken = token;
        fetchUserInfo();
    }
}

function fetchUserInfo() {
    fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `token ${githubToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        user = data;
        usernameSpan.textContent = data.login;
        userInfo.style.display = 'block';
        loginBtn.style.display = 'none';
        loadNotes();
    })
    .catch(error => {
        console.error('Error fetching user info:', error);
        alert('Failed to authenticate with GitHub');
    });
}

function logout() {
    githubToken = null;
    user = null;
    userInfo.style.display = 'none';
    loginBtn.style.display = 'block';
    noteList.innerHTML = '';
}

function checkAuth() {
    // Check if token exists in localStorage (for persistence)
    const token = localStorage.getItem('githubToken');
    if (token) {
        githubToken = token;
        fetchUserInfo();
    }
}

// Note management
function loadNotes() {
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${NOTES_FOLDER}?ref=${GITHUB_BRANCH}`, {
        headers: {
            'Authorization': `token ${githubToken}`
        }
    })
    .then(response => response.json())
    .then(files => {
        noteList.innerHTML = '';
        noteSelector.innerHTML = '<option value="">Select a note to edit</option>';
        
        files.forEach(file => {
            if (file.name.endsWith('.md')) {
                // Add to sidebar list
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#';
                a.textContent = file.name.replace('.md', '');
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadNote(file.name);
                });
                li.appendChild(a);
                noteList.appendChild(li);
                
                // Add to dropdown selector
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name.replace('.md', '');
                noteSelector.appendChild(option);
            }
        });
    })
    .catch(error => {
        console.error('Error loading notes:', error);
        if (error.message.includes('404')) {
            // Notes folder doesn't exist yet
            createNotesFolder();
        }
    });
}

function loadNote(filename) {
    currentNote = filename;
    noteSelector.value = filename;
    
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${NOTES_FOLDER}/${filename}?ref=${GITHUB_BRANCH}`, {
        headers: {
            'Authorization': `token ${githubToken}`
        }
    })
    .then(response => response.json())
    .then(file => {
        const content = atob(file.content);
        markdownEditor.value = content;
        updatePreview();
    })
    .catch(error => {
        console.error('Error loading note:', error);
    });
}

function loadSelectedNote() {
    const filename = noteSelector.value;
    if (filename) {
        loadNote(filename);
    } else {
        currentNote = null;
        markdownEditor.value = '';
        updatePreview();
    }
}

function createNewNote() {
    const noteName = prompt('Enter a name for your new note:');
    if (noteName) {
        const filename = `${noteName}.md`;
        const content = `# ${noteName}\n\nStart writing here...`;
        
        createNote(filename, content);
    }
}

function createNote(filename, content) {
    const encodedContent = btoa(content);
    
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${NOTES_FOLDER}/${filename}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Create ${filename}`,
            content: encodedContent,
            branch: GITHUB_BRANCH
        })
    })
    .then(response => response.json())
    .then(data => {
        loadNotes();
        loadNote(filename);
    })
    .catch(error => {
        console.error('Error creating note:', error);
    });
}

function saveNote() {
    if (!currentNote) {
        alert('Please select a note to save');
        return;
    }
    
    const content = markdownEditor.value;
    const encodedContent = btoa(content);
    
    // First get the current SHA (needed for update)
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${NOTES_FOLDER}/${currentNote}?ref=${GITHUB_BRANCH}`, {
        headers: {
            'Authorization': `token ${githubToken}`
        }
    })
    .then(response => response.json())
    .then(file => {
        return fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${NOTES_FOLDER}/${currentNote}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update ${currentNote}`,
                content: encodedContent,
                sha: file.sha,
                branch: GITHUB_BRANCH
            })
        });
    })
    .then(response => response.json())
    .then(data => {
        alert('Note saved successfully!');
    })
    .catch(error => {
        console.error('Error saving note:', error);
        alert('Failed to save note');
    });
}

function createNotesFolder() {
    const readmeContent = btoa('# My Notebook\n\nThis folder contains my notes.');
    
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${NOTES_FOLDER}/README.md`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Create notes folder',
            content: readmeContent,
            branch: GITHUB_BRANCH
        })
    })
    .then(() => {
        loadNotes();
    })
    .catch(error => {
        console.error('Error creating notes folder:', error);
    });
}

function updatePreview() {
    preview.innerHTML = marked.parse(markdownEditor.value);
}
