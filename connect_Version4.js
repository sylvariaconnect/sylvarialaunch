// --- Connect Full Main JS Logic ---
// This file powers the Connect app: authentication, feed, friends, profiles, online users, modals, image cropping, etc.

// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import {
    getAuth, onAuthStateChanged, signOut,
    signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
    createUserWithEmailAndPassword, updateProfile
} from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, updateDoc, serverTimestamp as firestoreServerTimestamp, query, orderBy, onSnapshot, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp as rtdbServerTimestamp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-database.js";

// Cloudinary config
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/djkz4hbed/upload';
const CLOUDINARY_UPLOAD_PRESET = 'zaybn6xt';

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyB2NK-z6i74kTExGUE_ilN1jM8_oqEeSRs",
    authDomain: "sylvaria-universe.firebaseapp.com",
    projectId: "sylvaria-universe",
    storageBucket: "sylvaria-universe.firebasestorage.app",
    messagingSenderId: "256537971475",
    appId: "1:256537971475:web:baaac36786b918338428e6",
    measurementId: "G-4MCYL3VM15",
    databaseURL: "https://sylvaria-universe-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// --- Global State ---
let currentUserData = null;
let allUsersCache = [];
let uploadedMedia = null;
let cropper = null;

// --- Utility ---
function show(elementId) { document.getElementById(elementId).classList.remove("hidden"); }
function hide(elementId) { document.getElementById(elementId).classList.add("hidden"); }
function setHTML(elementId, html) { document.getElementById(elementId).innerHTML = html; }
function setValue(elementId, val) { document.getElementById(elementId).value = val; }
function getValue(elementId) { return document.getElementById(elementId).value; }
function appendHTML(elementId, html) { document.getElementById(elementId).insertAdjacentHTML("beforeend", html); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// --- Auth UI and Logic ---
function showLoginForm() {
    hide("main-content");
    hide("header-nav");
    setHTML("loading-screen", `
        <div class="w-full max-w-sm mx-auto bg-gray-800 p-8 rounded-2xl shadow-2xl animate-fade-in text-center">
            <h2 class="mb-6 text-3xl font-bold text-sky-400">Sign In</h2>
            <button id="google-login-btn" class="w-full flex items-center justify-center bg-white text-gray-900 py-3 rounded-xl font-semibold text-lg shadow hover:scale-[1.03] hover:shadow-lg transition mb-6 border border-gray-300">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-6 h-6 mr-2 -ml-2"> Continue with Google
            </button>
            <div class="flex items-center my-4">
                <div class="flex-grow border-t border-gray-600"></div>
                <span class="mx-3 text-gray-400 font-medium">or</span>
                <div class="flex-grow border-t border-gray-600"></div>
            </div>
            <form id="login-form" class="space-y-4 text-left">
                <div>
                    <label for="login-email" class="block text-sm text-gray-400 font-semibold mb-1">Email</label>
                    <input type="email" id="login-email" required class="w-full bg-gray-700 p-3 rounded-lg text-white border-2 border-gray-700 focus:border-sky-400 transition" placeholder="Email" autocomplete="email" />
                </div>
                <div>
                    <label for="login-password" class="block text-sm text-gray-400 font-semibold mb-1">Password</label>
                    <input type="password" id="login-password" required class="w-full bg-gray-700 p-3 rounded-lg text-white border-2 border-gray-700 focus:border-sky-400 transition" placeholder="Password" autocomplete="current-password" />
                </div>
                <button type="submit" class="w-full bg-sky-500 hover:bg-sky-600 py-3 rounded-xl font-bold text-white shadow transition">Sign In</button>
            </form>
            <button id="go-signup" class="w-full mt-2 bg-green-600 hover:bg-green-700 py-3 rounded-xl font-bold text-white shadow transition">Create Account</button>
            <div id="login-error" class="text-red-400 mt-4 font-semibold text-center"></div>
            <div id="login-loading" class="hidden mt-6 flex justify-center"><svg class="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg></div>
        </div>
    `);
    show("loading-screen");
    // Login handlers
    setTimeout(() => {
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            setHTML('login-error', '');
            show('login-loading');
            const email = getValue('login-email');
            const password = getValue('login-password');
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (err) {
                hide('login-loading');
                setHTML('login-error', err.message);
            }
        };
        document.getElementById('google-login-btn').onclick = async (e) => {
            e.preventDefault();
            setHTML('login-error', '');
            show('login-loading');
            try {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
            } catch (err) {
                hide('login-loading');
                setHTML('login-error', err.message);
            }
        };
        document.getElementById('go-signup').onclick = () => {
            show("signup-modal");
        };
    }, 500);
}

// --- Signup Modal Logic ---
function setupSignupModal() {
    document.getElementById("close-signup").onclick = () => { hide("signup-modal"); };
    document.getElementById("signup-form").onsubmit = async (e) => {
        e.preventDefault();
        setHTML("signup-error", "");
        show("signup-loading");
        const email = getValue("signup-email");
        const password = getValue("signup-password");
        const displayName = getValue("signup-display-name");
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCred.user, { displayName });
            // Create user doc
            await setDoc(doc(db, "users", userCred.user.uid), {
                displayName,
                email,
                profilePic: "",
                bio: "",
                friends: [],
                requests: [],
                online: false,
                created: firestoreServerTimestamp()
            });
            hide("signup-loading");
            hide("signup-modal");
        } catch (err) {
            hide("signup-loading");
            setHTML("signup-error", err.message);
        }
    };
}

// --- Main Auth State ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        showLoginForm();
        return;
    }
    hide("loading-screen");
    show("main-content");
    show("header-nav");
    // Load user data
    const userDoc = await getDoc(doc(db, "users", user.uid));
    currentUserData = userDoc.exists() ? userDoc.data() : {
        displayName: user.displayName || "",
        profilePic: "",
        bio: "",
        friends: [],
        requests: [],
        online: false,
    };
    renderProfileCard();
    setupMainUI();
    setupOnlinePresence(user.uid);
    loadFeed();
    loadAllUsers();
    loadFriendRequests();
    setupProfileEditModal();
    setupSignupModal();
});

// --- Main UI Navigation ---
function setupMainUI() {
    document.getElementById("home-button").onclick = () => showTab("feed-page-container");
    document.getElementById("friends-button").onclick = () => showTab("friends-page-container");
    document.getElementById("notifications-button").onclick = () => showTab("notifications-page-container");
    document.getElementById("mypage-button").onclick = () => showTab("mypage-tab");
    document.getElementById("user-menu-button").onclick = () => {
        document.getElementById("user-menu-dropdown").classList.toggle("hidden");
    };
    document.getElementById("sign-out-button").onclick = async () => {
        await signOut(auth);
        location.reload();
    };
    document.getElementById("photo-button").onclick = () => document.getElementById("media-upload-input").click();
    document.getElementById("media-upload-input").onchange = handleMediaUpload;
    document.getElementById("feeling-button").onclick = showFeelingModal;
    document.getElementById("add-poll-option").onclick = () => addPollOptionInput();
    document.getElementById("post-type").onchange = (e) => {
        if (e.target.value === "poll") {
            show("poll-options-container");
            if (document.getElementById("poll-options-list").childElementCount === 0) { addPollOptionInput(); addPollOptionInput(); }
        } else {
            hide("poll-options-container");
            document.getElementById("poll-options-list").innerHTML = "";
        }
    };
    document.getElementById("create-post-button").onclick = createPost;
}

// --- Tabs ---
function showTab(tabId) {
    ["feed-page-container", "friends-page-container", "notifications-page-container", "profile-page-container", "mypage-tab"].forEach(id => hide(id));
    show(tabId);
}

// --- Profile Card Render ---
function renderProfileCard() {
    setHTML("profile-card", `
        <div class="relative">
            <img src="${currentUserData.profilePic || 'https://api.dicebear.com/7.x/person/svg?seed=' + encodeURIComponent(currentUserData.displayName)}" class="profile-pic mx-auto mb-2"/>
            <button class="profile-edit-btn" id="edit-profile-btn"><i class="fas fa-edit"></i></button>
        </div>
        <h2 class="text-lg font-bold">${currentUserData.displayName}</h2>
        <p class="text-gray-400 text-sm mb-2">${currentUserData.bio || ''}</p>
        <span class="inline-block bg-green-600 px-3 py-1 rounded-full text-xs font-semibold">${currentUserData.online ? 'Online' : 'Offline'}</span>
    `);
    document.getElementById("edit-profile-btn").onclick = () => show("profile-edit-modal");
}

// --- Profile Edit Modal Logic ---
function setupProfileEditModal() {
    hide("profile-edit-modal");
    document.getElementById("close-profile-edit").onclick = () => hide("profile-edit-modal");
    document.getElementById("display-name-edit").value = currentUserData.displayName;
    document.getElementById("profile-pic-crop").src = currentUserData.profilePic || '';
    document.getElementById("profile-pic-upload").onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            document.getElementById("profile-pic-crop").src = evt.target.result;
            cropper = new Cropper(document.getElementById("profile-pic-crop"), { aspectRatio: 1 });
        };
        reader.readAsDataURL(file);
    };
    document.getElementById("crop-profile-pic").onclick = async () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({ width: 256, height: 256 });
        const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
        const formData = new FormData();
        formData.append('file', blob, 'profile.png');
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const resp = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await resp.json();
        document.getElementById("profile-pic-crop").src = data.secure_url;
        cropper.destroy();
        cropper = null;
    };
    document.getElementById("profile-edit-form").onsubmit = async (e) => {
        e.preventDefault();
        const displayName = getValue("display-name-edit");
        const profilePic = document.getElementById("profile-pic-crop").src;
        try {
            await updateProfile(auth.currentUser, { displayName, photoURL: profilePic });
            await updateDoc(doc(db, "users", auth.currentUser.uid), { displayName, profilePic });
            currentUserData.displayName = displayName;
            currentUserData.profilePic = profilePic;
            renderProfileCard();
            hide("profile-edit-modal");
        } catch (err) {
            setHTML("profile-edit-error", err.message);
        }
    };
}

// --- Online Presence ---
function setupOnlinePresence(uid) {
    const userStatusDatabaseRef = ref(rtdb, "/status/" + uid);
    set(userStatusDatabaseRef, { state: "online", last_changed: rtdbServerTimestamp() });
    onDisconnect(userStatusDatabaseRef).set({ state: "offline", last_changed: rtdbServerTimestamp() });
    // Listen for online users
    onValue(ref(rtdb, "/status"), (snapshot) => {
        const onlineUsers = [];
        snapshot.forEach(child => {
            if (child.val().state === "online") onlineUsers.push(child.key);
        });
        renderOnlineUsers(onlineUsers);
    });
}
function renderOnlineUsers(onlineUserIds) {
    setHTML("online-users-container", "");
    onlineUserIds.forEach(uid => {
        const user = allUsersCache.find(u => u.id === uid);
        if (user) appendHTML("online-users-container", `
            <div class="flex items-center gap-2">
                <img src="${user.profilePic || 'https://api.dicebear.com/7.x/person/svg?seed=' + encodeURIComponent(user.displayName)}" class="profile-pic" style="width:2rem; height:2rem;">
                <span class="font-semibold text-sm">${user.displayName}</span>
            </div>
        `);
    });
}

// --- Feed ---
async function loadFeed() {
    setHTML("feed-container", "<p>Loading posts...</p>");
    onSnapshot(query(collection(db, "posts"), orderBy("created", "desc")), async (snapshot) => {
        let html = "";
        for (const docSnap of snapshot.docs) {
            const post = docSnap.data();
            html += renderPost(docSnap.id, post);
        }
        setHTML("feed-container", html);
        setupFeedActions();
    });
}
function renderPost(postId, post) {
    let mediaHtml = post.mediaUrl ? `<img src="${post.mediaUrl}" class="w-full rounded-xl mb-2" style="max-height:320px;object-fit:cover;" />` : "";
    let pollHtml = "";
    if (post.type === "poll") {
        pollHtml += `<div class="mb-2"><strong>${post.question}</strong></div>`;
        let totalVotes = post.pollOptions.reduce((sum, opt) => sum + (opt.votes || 0), 0);
        pollHtml += post.pollOptions.map((opt, idx) => {
            let pct = totalVotes > 0 ? Math.round(100 * (opt.votes || 0) / totalVotes) : 0;
            return `
                <div>
                    <button class="poll-vote-btn bg-gray-700 text-white px-2 py-1 rounded poll-option" data-postid="${postId}" data-option="${idx}">${opt.text}</button>
                    <div class="poll-bar" style="width:${pct}%;"></div>
                    <span class="text-xs text-gray-400">${opt.votes || 0} votes (${pct}%)</span>
                </div>
            `;
        }).join("");
    }
    let likesCount = post.likes ? post.likes.length : 0;
    let commentsHtml = (post.comments || []).map(c => `<div class="mb-1"><span class="font-bold">${c.user}:</span> ${c.text}</div>`).join("");
    return `
        <div class="mb-4 card">
            <div class="flex gap-2 items-center mb-2">
                <img src="${post.authorPic || 'https://api.dicebear.com/7.x/person/svg?seed=' + encodeURIComponent(post.author)}" class="profile-pic" style="width:2rem; height:2rem;">
                <span class="font-bold">${post.author}</span>
                <span class="text-xs text-gray-400 ml-2">${post.created && post.created.toDate ? post.created.toDate().toLocaleString() : ""}</span>
            </div>
            ${mediaHtml}
            <div class="mb-2">${post.content || ''}</div>
            ${pollHtml}
            <div class="flex gap-3 mb-2">
                <button class="like-button ${post.likes && post.likes.includes(auth.currentUser.uid) ? 'liked' : ''}" data-id="${postId}"><i class="fas fa-heart"></i> ${likesCount}</button>
                <button class="comment-button" data-id="${postId}"><i class="fas fa-comment"></i> Comment</button>
                <button class="share-button" data-id="${postId}"><i class="fas fa-share"></i> Share</button>
            </div>
            <div class="comments-list">${commentsHtml}</div>
            <form class="comment-form" data-id="${postId}">
                <input type="text" class="comment-input bg-gray-700 rounded px-2 py-1 w-full" placeholder="Write a comment..." />
                <button type="submit" class="bg-sky-500 text-white px-2 py-1 rounded ml-2">Post</button>
            </form>
        </div>
    `;
}
function setupFeedActions() {
    document.querySelectorAll(".like-button").forEach(btn => btn.onclick = async (e) => {
        const postId = btn.dataset.id;
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        let likes = postSnap.data().likes || [];
        if (!likes.includes(auth.currentUser.uid)) likes.push(auth.currentUser.uid);
        else likes = likes.filter(id => id !== auth.currentUser.uid);
        await updateDoc(postRef, { likes });
    });
    document.querySelectorAll(".comment-form").forEach(form => form.onsubmit = async (e) => {
        e.preventDefault();
        const postId = form.dataset.id;
        const input = form.querySelector(".comment-input");
        if (!input.value) return;
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        let comments = postSnap.data().comments || [];
        comments.push({ user: currentUserData.displayName, text: input.value });
        await updateDoc(postRef, { comments });
        input.value = "";
    });
    document.querySelectorAll(".poll-vote-btn").forEach(btn => btn.onclick = async (e) => {
        const postId = btn.dataset.postid;
        const optionIdx = Number(btn.dataset.option);
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        let pollOptions = postSnap.data().pollOptions || [];
        pollOptions[optionIdx].votes = (pollOptions[optionIdx].votes || 0) + 1;
        await updateDoc(postRef, { pollOptions });
    });
}

// --- Create Post Logic ---
async function createPost() {
    const type = getValue("post-type");
    const content = getValue("post-content");
    let mediaUrl = uploadedMedia || "";
    let pollOptions = [];
    let question = "";
    if (type === "poll") {
        question = content;
        pollOptions = Array.from(document.getElementById("poll-options-list").children).map(input => ({ text: input.value, votes: 0 }));
        if (pollOptions.length < 2) return alert("Poll needs at least 2 options.");
    }
    await addDoc(collection(db, "posts"), {
        author: currentUserData.displayName,
        authorPic: currentUserData.profilePic || "",
        content: type === "poll" ? "" : content,
        type,
        question,
        pollOptions,
        mediaUrl,
        likes: [],
        comments: [],
        created: firestoreServerTimestamp()
    });
    setValue("post-content", "");
    document.getElementById("media-preview-container").innerHTML = "";
    uploadedMedia = null;
    if (type === "poll") { document.getElementById("poll-options-list").innerHTML = ""; hide("poll-options-container"); }
}

// --- Media Upload ---
function handleMediaUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
        document.getElementById("media-preview-container").innerHTML = `<img src="${evt.target.result}" class="w-full rounded-xl mb-2" style="max-height:240px;object-fit:cover;" />`;
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const resp = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await resp.json();
        uploadedMedia = data.secure_url;
    };
    reader.readAsDataURL(file);
}

// --- Poll Option UI ---
function addPollOptionInput(val='') {
    const input = document.createElement('input');
    input.className = 'poll-option bg-gray-800 text-white rounded px-2 py-1 block';
    input.type = 'text';
    input.value = val;
    input.placeholder = "Option text";
    document.getElementById('poll-options-list').appendChild(input);
}

// --- Feelings Modal ---
function showFeelingModal() {
    show("feeling-modal");
    setHTML("emoji-grid", "");
    const emojis = ["😀","😅","😐","😍","😢","😡","🤔","😲","🥳","😴","🤕","🥺","🤩","😎","🫠","🥶","😱","🤠"];
    emojis.forEach(e => appendHTML("emoji-grid", `<span class="cursor-pointer" onclick="chooseFeeling('${e}')">${e}</span>`));
}
window.chooseFeeling = function(emoji) {
    setValue("post-content", `${getValue("post-content")} ${emoji}`);
    hide("feeling-modal");
};

// --- All Users (Friends Page) ---
async function loadAllUsers() {
    const snapshot = await getDocs(collection(db, "users"));
    allUsersCache = [];
    let html = "";
    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        const uid = docSnap.id;
        allUsersCache.push({ ...u, id: uid });
        if (uid !== auth.currentUser.uid) {
            html += `
                <div class="flex items-center gap-3 mb-2 card">
                    <img src="${u.profilePic || 'https://api.dicebear.com/7.x/person/svg?seed=' + encodeURIComponent(u.displayName)}" class="profile-pic" style="width:2rem; height:2rem;">
                    <span class="font-semibold">${u.displayName}</span>
                    <button class="add-friend-btn bg-green-500 text-white px-2 py-1 rounded ml-auto" data-uid="${uid}">Add Friend</button>
                </div>
            `;
        }
    });
    setHTML("all-users-container", html);
    document.querySelectorAll(".add-friend-btn").forEach(btn => btn.onclick = async () => {
        const uid = btn.dataset.uid;
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        let requests = userSnap.data().requests || [];
        if (!requests.includes(auth.currentUser.uid)) {
            requests.push(auth.currentUser.uid);
            await updateDoc(userRef, { requests });
        }
        btn.textContent = "Requested";
        btn.disabled = true;
    });
}

// --- Friend Requests ---
async function loadFriendRequests() {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    const requests = userSnap.data().requests || [];
    let html = "";
    requests.forEach(uid => {
        const u = allUsersCache.find(u => u.id === uid);
        if (u) {
            html += `
                <div class="flex items-center gap-3 mb-2 card">
                    <img src="${u.profilePic || 'https://api.dicebear.com/7.x/person/svg?seed=' + encodeURIComponent(u.displayName)}" class="profile-pic" style="width:2rem; height:2rem;">
                    <span class="font-semibold">${u.displayName}</span>
                    <button class="accept-friend-btn bg-sky-500 text-white px-2 py-1 rounded ml-auto" data-uid="${uid}">Accept</button>
                </div>
            `;
        }
    });
    setHTML("friend-requests-container", html);
    document.querySelectorAll(".accept-friend-btn").forEach(btn => btn.onclick = async () => {
        const uid = btn.dataset.uid;
        // Add to friends
        const userRef = doc(db, "users", auth.currentUser.uid);
        const mySnap = await getDoc(userRef);
        let friends = mySnap.data().friends || [];
        if (!friends.includes(uid)) friends.push(uid);
        let requests = mySnap.data().requests || [];
        requests = requests.filter(id => id !== uid);
        await updateDoc(userRef, { friends, requests });
        // Also add you to their friends
        const friendRef = doc(db, "users", uid);
        const friendSnap = await getDoc(friendRef);
        let theirFriends = friendSnap.data().friends || [];
        if (!theirFriends.includes(auth.currentUser.uid)) theirFriends.push(auth.currentUser.uid);
        await updateDoc(friendRef, { friends: theirFriends });
        loadFriendRequests();
        loadAllUsers();
    });
}

// --- My Page Tab (Bio, Posts) ---
document.getElementById("save-mypage-bio").onclick = async () => {
    const bio = getValue("mypage-bio");
    await updateDoc(doc(db, "users", auth.currentUser.uid), { bio });
    currentUserData.bio = bio;
    renderProfileCard();
};
async function loadMyPosts() {
    const snapshot = await getDocs(query(collection(db, "posts"), orderBy("created", "desc")));
    let html = "";
    snapshot.forEach(docSnap => {
        const post = docSnap.data();
        if (post.author === currentUserData.displayName) {
            html += renderPost(docSnap.id, post);
        }
    });
    setHTML("mypage-feed-container", html);
}
document.getElementById("mypage-button").onclick = loadMyPosts;

// --- Profile View Tab (Other's profile) ---
document.getElementById("back-to-feed").onclick = () => showTab("feed-page-container");

// --- Initial Setup ---
window.onload = () => {
    setupSignupModal();
    showLoginForm();
};