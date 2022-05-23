// Initialize the Image Classifier method with DoodleNet.
let classifier;

// Two variable to hold the label and confidence of the result
let labelSpan;
let confidenceSpan;
let clearButton;
let canvas;

function preload() {    // doodleNet 이미지 분류기 불러옴
  classifier = ml5.imageClassifier('DoodleNet');
}

function setup() {      // 기초 세팅 작업
  canvas = createCanvas(280, 280);
  background(255);
  classifier.classify(canvas, gotResult);

  // Create a clear canvas button
  clearButton = select("#clearBtn");
  clearButton.mousePressed(clearCanvas);

  // Create 'label' and 'confidence' div to hold results
  labelSpan = select("#label");
  confidenceSpan = select("#confidence");
}


function clearCanvas() {
  background(255);
}


function draw() {
  strokeWeight(16);
  stroke(0);
  if (mouseIsPressed) {
    line(pmouseX, pmouseY, mouseX, mouseY);
  }
}


// A function to run when we get any errors and the results
function gotResult(error, results) {
  // Display error in the console
  if (error) {
    console.error(error);
    return;
  }
  // The results are in an array ordered by confidence.
  // console.log(results);
  // Show the first label and confidence
  labelSpan.html(results[0].label);
  confidenceSpan.html(floor(100 * results[0].confidence));
  classifier.classify(canvas, gotResult);
}

