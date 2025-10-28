// Emotion-Aware Tutor: detection + adaptive teaching + voice
// Uses face-api.js CDN models (no local model folder required)

let chosenSubject = null;
let lessonIndex = 0;
let teachInterval = null;
let speaking = false;
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const lessonTextEl = document.getElementById('lessonText');
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('backBtn');

const SUBJECTS = {
  os: [
    "An Operating System manages hardware and software resources.",
    "CPU scheduling decides which process runs next.",
    "Memory management keeps programs isolated and efficient.",
    "File systems organize how data is stored and retrieved."
  ],
  adsa: [
    "A Stack follows LIFO: last item in, first out.",
    "Queues are FIFO: first item in, first out.",
    "Trees store hierarchical data — binary tree has two children max.",
    "Graphs model relationships between entities."
  ],
  java: [
    "Java is an object-oriented language using classes and objects.",
    "Inheritance enables code reuse by deriving classes from others.",
    "Interfaces specify method contracts without implementation.",
    "Threads allow concurrent execution in Java applications."
  ]
};

// Simple adaptive versions (shorter/simpler) for sad/confused mood
const SIMPLE_REPHRASE = {
  os: [
    "OS helps run apps and manage devices.",
    "Scheduler picks which app uses CPU next.",
    "Memory keeps programs separate and safe.",
    "Files let you store your data."
  ],
  adsa: [
    "Stack: last in, first out.",
    "Queue: first in, first out.",
    "Tree: items in parent/child form.",
    "Graph: items connected by edges."
  ],
  java: [
    "Java uses classes; classes make objects.",
    "Inheritance: child class gets parent's code.",
    "Interface: a list of methods a class must have.",
    "Threads: let multiple tasks run together."
  ]
};

// =========== UI helpers ===========
function pick(subjectKey) {
  chosenSubject = subjectKey;
  startBtn.disabled = false;
  statusEl.textContent = `Selected: ${subjectKey.toUpperCase()}. Click Start Lesson.`;
}

function goBack() {
  // stop any running detection or speaking
  stopTeaching();
  document.querySelector('.ai-area').style.display = 'none';
  document.querySelector('.choose').style.display = 'flex';
  startBtn.disabled = true;
  backBtn.style.display = 'none';
  statusEl.textContent = "Waiting...";
  lessonTextEl.textContent = "";
}

// =========== Model loading & camera ===========
async function loadModels() {
  statusEl.textContent = "Loading AI models (from CDN)...";
  try {
    const modelURL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelURL),
      faceapi.nets.faceExpressionNet.loadFromUri(modelURL),
      faceapi.nets.ageGenderNet.loadFromUri(modelURL)
    ]);
    statusEl.textContent = "Models loaded. Starting camera...";
    await startCamera();
  } catch (err) {
    console.error("Model load error:", err);
    statusEl.textContent = "Error loading models.";
  }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    statusEl.textContent = "Camera started. Preparing lesson...";
    // attach overlay size
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    startTeachingLoop();
  } catch (err) {
    console.error("Camera error:", err);
    statusEl.textContent = "Camera access denied or unavailable.";
  }
}

// =========== Teaching loop ===========
function startLesson() {
  if (!chosenSubject) {
    alert("Choose a subject first.");
    return;
  }
  document.querySelector('.choose').style.display = 'none';
  document.querySelector('.ai-area').style.display = 'block';
  backBtn.style.display = 'inline-block';
  lessonIndex = 0;
  loadModels(); // loads models and starts camera -> startTeachingLoop()
}

function stopTeaching() {
  // stop intervals and speech
  if (teachInterval) { clearInterval(teachInterval); teachInterval = null; }
  if (video && video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(t => t.stop());
    video.srcObject = null;
  }
  window.speechSynthesis.cancel();
}

// start detection + lesson scheduling
function startTeachingLoop() {
  // run detection every 2.5s and speak lesson every 6s (adaptive)
  teachInterval = setInterval(async () => {
    // detect face + expressions
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
    let dominant = null;
    if (detections && detections.length > 0) {
      const expr = detections[0].expressions;
      dominant = Object.keys(expr).reduce((a,b)=> expr[a] > expr[b] ? a : b);
      // draw box (minimal)
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0,0,overlay.width,overlay.height);
      const resized = faceapi.resizeResults(detections, { width: overlay.width, height: overlay.height });
      faceapi.draw.drawDetections(overlay, resized);
    } else {
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0,0,overlay.width,overlay.height);
    }

    // Decide what to teach / speak based on current dominant emotion (or neutral)
    const emo = dominant || 'neutral';
    // show short status
    statusEl.textContent = `Emotion: ${emo}`;

    // prepare lesson text (adaptive)
    let base = SUBJECTS[chosenSubject][lessonIndex % SUBJECTS[chosenSubject].length];
    let simple = SIMPLE_REPHRASE[chosenSubject][lessonIndex % SIMPLE_REPHRASE[chosenSubject].length];
    let speakText = base;

    if (emo === 'sad' || emo === 'disgusted' || emo === 'fear') {
      // simplify and be encouraging
      speakText = `${simple} Don't worry — we'll go step by step.`;
    } else if (emo === 'angry') {
      speakText = `Take a deep breath. ${simple}`;
    } else if (emo === 'happy' || emo === 'surprised') {
      // encourage and move to a slightly advanced tip
      speakText = `${base} Great! Here's a quick tip: try an example to practice.`;
    } else {
      // neutral or other
      speakText = base;
    }

    // update lesson text area
    lessonTextEl.textContent = speakText;

    // speak (avoid overlapping)
    if (!speaking) {
      speakAdaptive(speakText, emo);
      // increment lesson only if mood is neutral/happy (otherwise repeat / simplify)
      if (emo === 'happy' || emo === 'neutral' || emo === 'surprised') {
        lessonIndex++;
      }
    }

  }, 3000); // run every 3s
}

// =========== Speech synthesis with tone selection ===========
function speakAdaptive(text, emotion='neutral') {
  speaking = true;
  const synth = window.speechSynthesis;
  synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';

  // adjust voice tone
  switch (emotion) {
    case 'happy': u.pitch = 1.3; u.rate = 1.05; break;
    case 'sad': u.pitch = 0.8; u.rate = 0.9; break;
    case 'angry': u.pitch = 0.95; u.rate = 0.95; break;
    case 'surprised': u.pitch = 1.4; u.rate = 1.15; break;
    default: u.pitch = 1.0; u.rate = 1.0;
  }

  u.onend = () => { speaking = false; };
  synth.speak(u);
}

// =========== Buttons wired to window for HTML onclick ===========
window.pick = pick;
window.startLesson = startLesson;
window.goBack = goBack;

// ensure overlay sizes set when video metadata is loaded
video.addEventListener('loadedmetadata', () => {
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
});
