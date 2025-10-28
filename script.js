// Simulated Emotion + Age Aware AI Tutor
const statusEl = document.getElementById("status");
const lessonTextEl = document.getElementById("lessonText");
const startBtn = document.getElementById("startBtn");
let chosenSubject = null;
let lessonIndex = 0;
let interval = null;
let speaking = false;

const SUBJECTS = {
  os: [
    "An Operating System manages resources between programs.",
    "CPU scheduling decides which process runs next.",
    "Memory management ensures efficient use of RAM.",
    "File systems control how data is stored and retrieved."
  ],
  adsa: [
    "Stacks follow LIFO — last in, first out.",
    "Queues follow FIFO — first in, first out.",
    "Trees store data in parent-child relationships.",
    "Graphs show connections between entities."
  ],
  java: [
    "Java is an object-oriented programming language.",
    "Inheritance lets one class use another’s features.",
    "Interfaces define method contracts.",
    "Threads allow parallel execution."
  ]
};

const SIMPLE = {
  os: [
    "OS helps apps and devices work together.",
    "Scheduler decides which app runs next.",
    "Memory keeps programs safe and separate.",
    "Files store your data neatly."
  ],
  adsa: [
    "Stack: last in, first out.",
    "Queue: first in, first out.",
    "Tree: items in parent/child form.",
    "Graph: items connected together."
  ],
  java: [
    "Java makes objects from classes.",
    "Inheritance: child class gets parent’s code.",
    "Interface: tells which methods must exist.",
    "Threads let tasks run side by side."
  ]
};

// Fake emotion/age generators
const EMOTIONS = ["happy","neutral","sad","angry","surprised"];
const GENDERS = ["male","female"];

function pick(sub){
  chosenSubject = sub;
  startBtn.disabled = false;
  statusEl.textContent = `Selected: ${sub.toUpperCase()}. Click Start Lesson.`;
}

function goBack(){
  clearInterval(interval);
  window.speechSynthesis.cancel();
  document.querySelector(".ai-area").style.display = "none";
  document.querySelector(".choose").style.display = "block";
  startBtn.disabled = true;
  document.getElementById("backBtn").style.display = "none";
  statusEl.textContent = "Waiting...";
  lessonTextEl.textContent = "";
}

function startLesson(){
  if(!chosenSubject){ alert("Choose a subject first."); return; }
  document.querySelector(".choose").style.display = "none";
  document.querySelector(".ai-area").style.display = "block";
  document.getElementById("backBtn").style.display = "inline-block";
  lessonIndex = 0;
  simulateTutor();
}

function simulateTutor(){
  interval = setInterval(()=>{
    const emotion = EMOTIONS[Math.floor(Math.random()*EMOTIONS.length)];
    const age = Math.floor(Math.random()*30)+10; // 10-40
    const gender = GENDERS[Math.floor(Math.random()*GENDERS.length)];

    statusEl.textContent = `Emotion: ${emotion} | Age: ${age} | Gender: ${gender}`;

    const base = SUBJECTS[chosenSubject][lessonIndex % SUBJECTS[chosenSubject].length];
    const simple = SIMPLE[chosenSubject][lessonIndex % SIMPLE[chosenSubject].length];
    let speakText = base;

    let ageGroup = age < 13 ? "child" : age < 18 ? "teen" : age < 30 ? "young_adult" : "adult";

    if(emotion === "sad"){
      speakText = ageGroup==="child"||ageGroup==="teen"
        ? `${simple} Don’t worry — we’ll go step by step.`
        : `${simple} Let’s review the basics once more.`;
    } else if(emotion === "angry"){
      speakText = `Take a deep breath. ${simple}`;
    } else if(emotion === "happy" || emotion === "surprised"){
      speakText = `${base} Great! Here’s a quick tip to try.`;
      lessonIndex++;
    }

    lessonTextEl.textContent = speakText;
    speakAdaptive(speakText, emotion, ageGroup);
  }, 4000);
}

function speakAdaptive(text, emotion, ageGroup){
  if(speaking) return;
  speaking = true;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";

  if(emotion==="happy"){u.pitch=1.2;u.rate=1.05;}
  else if(emotion==="sad"){u.pitch=0.85;u.rate=0.9;}
  else if(emotion==="angry"){u.pitch=0.95;u.rate=0.95;}
  else if(emotion==="surprised"){u.pitch=1.3;u.rate=1.1;}
  else {u.pitch=1.0;u.rate=1.0;}

  if(ageGroup==="child"){u.rate*=0.9;u.pitch*=1.1;}
  u.onend=()=>speaking=false;
  speechSynthesis.speak(u);
}
