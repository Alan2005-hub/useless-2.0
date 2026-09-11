const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");

const timer = document.getElementById("timer");
const blinks = document.getElementById("blinks");
const attention = document.getElementById("attention");

const condition = document.getElementById("condition");
const conditionBar = document.getElementById("conditionBar");
const message = document.getElementById("message");

const cameraStatus = document.getElementById("cameraStatus");
const faceStatus = document.getElementById("faceStatus");
const blinkStatus = document.getElementById("blinkStatus");

const tearLeft = document.getElementById("tearLeft");
const tearRight = document.getElementById("tearRight");

const tears = [
    tearLeft,
    tearRight
];

const veins = document.querySelectorAll(".veins");

const irisLeft = document.getElementById("irisLeft");
const irisRight = document.getElementById("irisRight");

const finalScreen = document.getElementById("final");
const finalTitle = document.getElementById("finalTitle");
const finalMessage = document.getElementById("finalMessage");
const finalImage = document.getElementById("finalImage");

const webcam = document.getElementById("webcam");


/* ======================================================
   FINAL IMAGES
   ====================================================== */

const blinkImage =
    "https://tse2.mm.bing.net/th/id/OIP.w2AR4zYhZ9HLfKcxuidPpQHaFa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3";

const survivedImage =
    "https://i.pinimg.com/originals/7f/46/01/7f4601717c04eacd20079e309a5fece5.jpg";


/* ======================================================
   AUDIO
   ====================================================== */

/* Sayip sound — plays when user blinks */

const sayipSound =
    "https://www.myinstants.com/media/sounds/ayooo-sayip-op.mp3";


/* FAH sound — plays after surviving 20 seconds */

const fahSound =
    "https://www.myinstants.com/media/sounds/fahhhhhhhhhhhhhh.mp3";


const sayipAudio =
    new Audio(sayipSound);

const fahAudio =
    new Audio(fahSound);


sayipAudio.volume = 1.0;

fahAudio.preload = "auto";
fahAudio.volume = 1.0;


/* ======================================================
   VARIABLES
   ====================================================== */

let seconds = 0;

let blinkCounter = 0;

let running = false;

let lastEyeState = "open";

let blinkCooldown = false;


/* ======================================================
   PUPIL MOVEMENT
   ====================================================== */

let currentGazeX = 0;
let currentGazeY = 0;

let targetGazeX = 0;
let targetGazeY = 0;

const MAX_PUPIL_X = 22;
const MAX_PUPIL_Y = 12;


/* ======================================================
   START EXPERIMENT
   ====================================================== */

startButton.addEventListener("click", async function() {

    startButton.disabled = true;

    startButton.textContent = "STARTING...";


    try {

        await startCamera();


        /* ==============================================
           UNLOCK FAH AUDIO DURING USER CLICK
           This allows it to play at 20 seconds
           ============================================== */

        fahAudio.load();

        fahAudio.muted = true;

        fahAudio.play().then(function() {

            fahAudio.pause();

            fahAudio.currentTime = 0;

            fahAudio.muted = false;

        }).catch(function(error) {

            fahAudio.muted = false;

            console.log(
                "FAH audio unlock failed:",
                error
            );

        });


        startScreen.style.display = "none";


        running = true;

        seconds = 0;

        blinkCounter = 0;

        lastEyeState = "open";

        blinkCooldown = false;


        timer.textContent = "00:00";

        blinks.textContent = "0";


        message.textContent =
            "THE EYES ARE A WINDOW TO ATTENTION.";


        updateEyes();

        startTimer();

        requestAnimationFrame(animatePupils);


    } catch(error) {

        console.error(error);


        startButton.disabled = false;

        startButton.textContent = "START EXPERIMENT";


        alert(
            "Camera access is required for blink detection."
        );

    }

});


/* ======================================================
   CAMERA
   ====================================================== */

async function startCamera() {

    const stream =
        await navigator.mediaDevices.getUserMedia({

            video: true,
            audio: false

        });


    webcam.srcObject = stream;


    cameraStatus.classList.add("active");


    await webcam.play();


    setupFaceMesh();

}


/* ======================================================
   MEDIAPIPE
   ====================================================== */

let faceMesh;

let camera;


function setupFaceMesh() {

    faceMesh = new FaceMesh({

        locateFile: function(file) {

            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;

        }

    });


    faceMesh.setOptions({

        maxNumFaces: 1,

        refineLandmarks: true,

        minDetectionConfidence: 0.5,

        minTrackingConfidence: 0.5

    });


    faceMesh.onResults(onFaceResults);


    camera = new Camera(webcam, {

        onFrame: async function() {

            if (!running) return;

            await faceMesh.send({
                image: webcam
            });

        },

        width: 640,

        height: 480

    });


    camera.start();

}


/* ======================================================
   FACE RESULTS
   ====================================================== */

function onFaceResults(results) {

    if (!running) return;


    if (
        results.multiFaceLandmarks &&
        results.multiFaceLandmarks.length > 0
    ) {

        faceStatus.classList.add("active");

        blinkStatus.classList.add("active");


        const landmarks =
            results.multiFaceLandmarks[0];


        detectBlink(landmarks);

        trackGaze(landmarks);


    } else {

        faceStatus.classList.remove("active");

    }

}


/* ======================================================
   DISTANCE
   ====================================================== */

function distance(a, b) {

    const dx = a.x - b.x;

    const dy = a.y - b.y;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );

}


/* ======================================================
   EYE ASPECT RATIO
   ====================================================== */

function eyeAspectRatio(
    landmarks,
    top1,
    bottom1,
    top2,
    bottom2,
    left,
    right
) {

    const vertical1 =
        distance(
            landmarks[top1],
            landmarks[bottom1]
        );


    const vertical2 =
        distance(
            landmarks[top2],
            landmarks[bottom2]
        );


    const horizontal =
        distance(
            landmarks[left],
            landmarks[right]
        );


    return (
        vertical1 +
        vertical2
    ) / (2 * horizontal);

}


/* ======================================================
   BLINK DETECTION
   ====================================================== */

function detectBlink(landmarks) {

    const leftEAR =
        eyeAspectRatio(
            landmarks,
            160,
            144,
            158,
            153,
            33,
            133
        );


    const rightEAR =
        eyeAspectRatio(
            landmarks,
            385,
            380,
            387,
            373,
            362,
            263
        );


    const ear =
        (leftEAR + rightEAR) / 2;


    const blinkThreshold = 0.21;


    if (ear < blinkThreshold) {

        if (lastEyeState === "open") {

            lastEyeState = "closed";

        }

    } else {

        if (lastEyeState === "closed") {

            lastEyeState = "open";

            registerBlink();

        }

    }

}


/* ======================================================
   GAZE TRACKING
   ====================================================== */

function trackGaze(landmarks) {

    const leftIris =
        landmarks[468];

    const rightIris =
        landmarks[473];


    const leftOuter =
        landmarks[33];

    const leftInner =
        landmarks[133];


    const rightOuter =
        landmarks[263];

    const rightInner =
        landmarks[362];


    const leftWidth =
        Math.abs(
            leftInner.x -
            leftOuter.x
        );


    const rightWidth =
        Math.abs(
            rightInner.x -
            rightOuter.x
        );


    let leftX =
        (
            leftIris.x -
            Math.min(
                leftOuter.x,
                leftInner.x
            )
        ) / leftWidth;


    let rightX =
        (
            rightIris.x -
            Math.min(
                rightOuter.x,
                rightInner.x
            )
        ) / rightWidth;


    let gazeX =
        (leftX + rightX) / 2;


    const leftTop =
        Math.min(
            landmarks[159].y,
            landmarks[160].y
        );


    const leftBottom =
        Math.max(
            landmarks[144].y,
            landmarks[145].y
        );


    const rightTop =
        Math.min(
            landmarks[386].y,
            landmarks[387].y
        );


    const rightBottom =
        Math.max(
            landmarks[373].y,
            landmarks[374].y
        );


    let leftY =
        (
            leftIris.y -
            leftTop
        ) /
        (
            leftBottom -
            leftTop
        );


    let rightY =
        (
            rightIris.y -
            rightTop
        ) /
        (
            rightBottom -
            rightTop
        );


    let gazeY =
        (leftY + rightY) / 2;


    gazeX =
        (gazeX - 0.5) * 2;


    gazeY =
        (gazeY - 0.5) * 2;


    gazeX =
        Math.max(
            -1,
            Math.min(1, gazeX)
        );


    gazeY =
        Math.max(
            -1,
            Math.min(1, gazeY)
        );


    /*
       Important:
       Horizontal direction flipped because
       webcam coordinates are mirrored.
    */

    targetGazeX =
        -gazeX * MAX_PUPIL_X;


    targetGazeY =
        gazeY * MAX_PUPIL_Y;

}


/* ======================================================
   SMOOTH PUPIL MOVEMENT
   ====================================================== */

function animatePupils() {

    currentGazeX +=
        (
            targetGazeX -
            currentGazeX
        ) * 0.18;


    currentGazeY +=
        (
            targetGazeY -
            currentGazeY
        ) * 0.18;


    irisLeft.style.transform =
        `translate(${currentGazeX}px, ${currentGazeY}px)`;


    irisRight.style.transform =
        `translate(${currentGazeX}px, ${currentGazeY}px)`;


    requestAnimationFrame(
        animatePupils
    );

}


/* ======================================================
   BLINK REGISTER
   ====================================================== */

function registerBlink() {

    if (!running) return;


    if (blinkCooldown) return;


    blinkCooldown = true;


    running = false;


    blinkCounter++;


    blinks.textContent =
        blinkCounter;


    /*
       SAYIP SOUND PLAYS WHEN
       USER BLINKS BEFORE 20 SECONDS
    */

    sayipAudio.currentTime = 0;

    sayipAudio.play().catch(function(error) {

        console.log(
            "Sayip sound could not play:",
            error
        );

    });


    finalTitle.innerHTML =
        "YOU BLINKED.<br>THEY DIDN'T.";


    finalMessage.textContent =
        "Human attention experiment failed.";


    finalImage.src =
        blinkImage;


    message.textContent =
        "BLINK DETECTED.";


    stopCamera();


    setTimeout(function() {

        finalScreen.classList.add("show");

    }, 500);

}


/* ======================================================
   TIMER
   ====================================================== */

function startTimer() {

    const timerInterval =
        setInterval(function() {

            if (!running) {

                clearInterval(timerInterval);

                return;

            }


            seconds++;


            const minutes =
                Math.floor(
                    seconds / 60
                );


            const sec =
                seconds % 60;


            timer.textContent =
                String(minutes).padStart(2, "0") +
                ":" +
                String(sec).padStart(2, "0");


            updateEyes();


            if (seconds >= 20) {

                clearInterval(timerInterval);

                finishExperiment();

            }

        }, 1000);

}


/* ======================================================
   EYE CONDITION
   ====================================================== */

function updateEyes() {

    if (seconds < 5) {

        condition.textContent =
            "NORMAL";

        condition.style.color =
            "#65dba0";


        message.textContent =
            "THEY ARE STILL WATCHING.";


        conditionBar.style.width =
            "5%";


        conditionBar.style.background =
            "#65dba0";


        veins.forEach(function(v) {

            v.style.opacity = "0";

        });


        tears.forEach(function(t) {

            t.classList.remove("active");

        });


    } else if (seconds < 10) {

        condition.textContent =
            "SLIGHTLY IRRITATED";

        condition.style.color =
            "#d99a72";


        message.textContent =
            "MAINTAIN EYE CONTACT.";


        conditionBar.style.width =
            "30%";


        conditionBar.style.background =
            "#d99a72";


        veins.forEach(function(v) {

            v.style.opacity = "0.25";

        });


        tears.forEach(function(t) {

            t.classList.remove("active");

        });


    } else if (seconds < 13) {

        condition.textContent =
            "MORE IRRITATED";


        condition.style.color =
            "#df7777";


        message.textContent =
            "THEY ARE GETTING TIRED.";


        conditionBar.style.width =
            "60%";


        conditionBar.style.background =
            "#df7777";


        veins.forEach(function(v) {

            v.style.opacity = "0.6";

        });


        tears.forEach(function(t) {

            t.classList.remove("active");

        });


    } else if (seconds < 20) {

        condition.textContent =
            "IRRITATED + TEARY";


        condition.style.color =
            "#ef4545";


        message.textContent =
            "THEY STILL WON'T BLINK.";


        conditionBar.style.width =
            "90%";


        conditionBar.style.background =
            "#df4545";


        veins.forEach(function(v) {

            v.style.opacity = "1";

        });


        tears.forEach(function(t) {

            t.classList.add("active");

        });

    }


    /* ================= ATTENTION ================= */

    const attentionValue =
        Math.max(
            40,
            95 - seconds * 2
        );


    if (attentionValue > 70) {

        attention.textContent =
            "FOCUSED";


        attention.style.color =
            "#e8e8e8";


    } else if (attentionValue > 55) {

        attention.textContent =
            "DECLINING";


        attention.style.color =
            "#d99a72";


    } else {

        attention.textContent =
            "FATIGUED";


        attention.style.color =
            "#df7777";

    }

}


/* ======================================================
   FINISH EXPERIMENT — USER SURVIVED 20 SECONDS
   ====================================================== */

function finishExperiment() {

    if (!running) return;


    running = false;


    condition.textContent =
        "CRITICAL";


    condition.style.color =
        "#ff2222";


    conditionBar.style.width =
        "100%";


    conditionBar.style.background =
        "#ff2222";


    message.textContent =
        "TIME LIMIT REACHED.";


    veins.forEach(function(v) {

        v.style.opacity = "1";

    });


    tears.forEach(function(t) {

        t.classList.add("active");

    });


    /*
       FAH AUDIO PLAYS WHEN
       TIMER REACHES 20 SECONDS
    */

    fahAudio.currentTime = 0;

    fahAudio.muted = false;

    fahAudio.play().then(function() {

        console.log(
            "FAH audio playing"
        );

    }).catch(function(error) {

        console.error(
            "FAH audio failed:",
            error
        );

    });


    finalTitle.innerHTML =
        "YOU MADE IT.";


    finalMessage.innerHTML =
        "<strong>What did you expect? 🤡</strong><br>" +
        "A useless project and you thought winning would earn applause?<br>" +
        "<strong>Dream on. 💀</strong>";


    finalImage.src =
        survivedImage;


    stopCamera();


    setTimeout(function() {

        finalScreen.classList.add("show");

    }, 700);

}


/* ======================================================
   STOP CAMERA
   ====================================================== */

function stopCamera() {

    if (webcam.srcObject) {

        webcam.srcObject
            .getTracks()
            .forEach(function(track) {

                track.stop();

            });

    }

}