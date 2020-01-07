// In this case, We set width 320, and the height will be computed based on the input stream.
let width = 320
let height = 0

// whether streaming video from the camera.
let streaming = false

let video = document.getElementById('video')
let stream = null
let vc = null

// Canny edge detector constants for OpenCV.js
const cannyThreshold1 = 75
const cannyThreshold2 = 130
const cannyApertureSize = 3
const cannyL2Gradient = true

function startCamera() {
  if (streaming) return
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then(function (s) {
      stream = s
      video.srcObject = s
      video.play()
    })
    .catch(function (err) {
      console.log('An error occured! ' + err)
    })

  video.addEventListener(
    'canplay',
    function (ev) {
      if (!streaming) {
        height = video.videoHeight / (video.videoWidth / width)
        video.setAttribute('width', width)
        video.setAttribute('height', height)
        streaming = true
        vc = new cv.VideoCapture(video)
      }
      startVideoProcessing()
    },
    false
  )
}

let src = null
let dstC1 = null
let dstC3 = null
let dstC4 = null

function startVideoProcessing() {
  if (!streaming) {
    console.warn('Please startup your webcam')
    return
  }
  stopVideoProcessing()
  src = new cv.Mat(height, width, cv.CV_8UC4)
  dstC1 = new cv.Mat(height, width, cv.CV_8UC1)
  dstC3 = new cv.Mat(height, width, cv.CV_8UC3)
  dstC4 = new cv.Mat(height, width, cv.CV_8UC4)
  requestAnimationFrame(processVideo)
}

function canny(src) {
  cv.cvtColor(src, dstC1, cv.COLOR_RGBA2GRAY)
  cv.Canny(
    dstC1,
    dstC1,
    cannyThreshold1,
    cannyThreshold2,
    cannyApertureSize,
    cannyL2Gradient
  )

  return dstC1
}

function matTo2DArray(mat) {
  var array = [];
  for (var r = 0; r < mat.rows; r++) {
    var row = []
    for (var c = 0; c < mat.cols; c++) {
      var i = r * mat.cols + c
      if (i < mat.data.length) {
        row.push(mat.ucharAt(i))
      }
    }
    array.push(row)
  }
  return array;
}

function matrixThinning(cannyMatrix, minimumDistanceVertical, minimumDistanceHorizontal) {
  const data = matTo2DArray(cannyMatrix)

  const locationsOfShapes = [];

  for (let i = 0; i < cannyMatrix.rows; i += minimumDistanceVertical) {
    for (let j = 0; j < cannyMatrix.cols; j += minimumDistanceHorizontal) {
      if (valueInSegment(data, i, j, minimumDistanceHorizontal, minimumDistanceVertical)) {
        setOneInTheMiddle(data, i, j, minimumDistanceHorizontal, minimumDistanceVertical)
        locationsOfShapes.push([i + Math.floor(minimumDistanceVertical / 2), j + Math.floor(minimumDistanceHorizontal / 2)])
      }
    }
  }

  return locationsOfShapes;
}

function setOneInTheMiddle(data, row, col, segmentWidth, segmentHeight) {
  for (let i = row; i < row + segmentHeight; i++) {
    for (let j = col; j < col + segmentWidth; j++) {
      if (i === (row + Math.floor(segmentHeight / 2)) && j === (col + Math.floor(segmentWidth / 2))) {
        data[i][j] = 1;
      } else {
        data[i][j] = 0;
      }
    }
  }
}

function valueInSegment(data, row, col, segmentWidth, segmentHeight) {
  for (let i = row; i < row + segmentHeight; i++) {
    for (let j = col; j < col + segmentWidth; j++) {
      if (data[i][j] !== 0) {
        return true
      }
    }
  }
  return false
}

let fullscreen = false
function toggleFullscreen() {
  $("canvas")[0].webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT); //Chrome
  $("canvas")[0].mozRequestFullScreen(); //Firefox
}

let verticalSparsity = 4;
let horizontalSparsity = 8;

function setVerticalSparsity() {
  verticalSparsity = parseInt($('#vertical_sparsity').val())
}

function setHorizontalSparsity() {
  horizontalSparsity = parseInt($('#horizontal_sparsity').val())
}

function processVideo() {
  vc.read(src)

  let result = canny(src)
  let shapeLocations = matrixThinning(result, verticalSparsity, horizontalSparsity)

  gameLoop(shapeLocations)
  requestAnimationFrame(processVideo)
}

function stopVideoProcessing() {
  if (src != null && !src.isDeleted()) src.delete()
  if (dstC1 != null && !dstC1.isDeleted()) dstC1.delete()
  if (dstC3 != null && !dstC3.isDeleted()) dstC3.delete()
  if (dstC4 != null && !dstC4.isDeleted()) dstC4.delete()
}

function stopCamera() {
  if (!streaming) return
  stopVideoProcessing()
  document
    .getElementById('canvasOutput')
    .getContext('2d')
    .clearRect(0, 0, width, height)
  video.pause()
  video.srcObject = null
  stream.getVideoTracks()[0].stop()
  streaming = false
}

function opencvIsReady() {
  console.log('OpenCV.js is ready')
  startCamera()
}

let pixiApp

// Plotting
let shapes = []

const SQUARES = 'squares'
const DOTS = 'dots'

const visualizations = [SQUARES, DOTS]

let selectedVisualization = visualizations[0]

const circleSizeRange = [5, 10]
const squareSizeRange = [2, 10]

let squareSize = getRandomInt(squareSizeRange[0], squareSizeRange[1]);
let circleSize = getRandomInt(circleSizeRange[0], circleSizeRange[1]);

function toggleRealCamera() {
  $('.invisible').toggle();
}

$(document).ready(() => {
  $('.ui.menu .ui.dropdown').dropdown({
    on: 'hover'
  })
  $('.ui .menu .item').on('click', function () {
    $(this)
      .addClass('active')
      .siblings()
      .removeClass('active')

    selectedVisualization =
      $(this).data('visualization') || selectedVisualization[0]
  })

  setupDemo()

  // Fullscreen in pixi is resizing the renderer to be window.innerWidth by window.innerHeight
  window.addEventListener('resize', function () {
    pixiApp.renderer.resize(window.innerWidth, window.innerHeight)
  })

})

// Create some text. Not important for fullscreen
function setupDemo() {
  pixiApp = new PIXI.Application(320, 240, {
    transparent: true
  })
  document.body.appendChild(pixiApp.view)

  pixiApp.renderer.resize(window.innerWidth, window.innerHeight)
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomizeShapes() {
  selectedVisualization = visualizations[Math.floor(Math.random() * visualizations.length)]
  squareSize = getRandomInt(squareSizeRange[0], squareSizeRange[1]);
  circleSize = getRandomInt(circleSizeRange[0], circleSizeRange[1]);
}


function gameLoop(shapeLocations) {

  pixiApp.stage.removeChildren();

  shapes = [];

  shapeLocations.forEach(([i, j]) => {
    let rectangle = new PIXI.Graphics()
    rectangle.lineStyle(2, 0xff3300, 1)
    rectangle.beginFill(0x66ccff)
    if (selectedVisualization === SQUARES) {
      rectangle.drawRect(0, 0, squareSize, squareSize)
    } else {
      rectangle.drawCircle(0, 0, circleSize, circleSize);
    }
    rectangle.endFill()
    rectangle.x = j * Math.floor((window.innerWidth / 320))
    rectangle.y = i * Math.floor((window.innerHeight / 240))
    rectangle.pivot.set(rectangle.width / 2, rectangle.height / 2)
    pixiApp.stage.addChild(rectangle)
    shapes.push(rectangle);
  })
}

var webaudio_tooling_obj = function () {

  var audioContext = new AudioContext();

  console.log("audio is starting up ...");

  var BUFF_SIZE = 16384;

  var audioInput = null,
      microphone_stream = null,
      gain_node = null,
      script_processor_node = null,
      script_processor_fft_node = null,
      analyserNode = null;

  if (!navigator.getUserMedia)
          navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                        navigator.mozGetUserMedia || navigator.msGetUserMedia;

  if (navigator.getUserMedia){

      navigator.getUserMedia({audio:true}, 
        function(stream) {
            start_microphone(stream);
        },
        function(e) {
          alert('Error capturing audio.');
        }
      );

  } else { alert('getUserMedia not supported in this browser.'); }

  // ---

  function show_some_data(given_typed_array, num_row_to_display, label) {

      var size_buffer = given_typed_array.length;
      var index = 0;
      var max_index = num_row_to_display;

      console.log("__________ " + label);

      for (; index < max_index && index < size_buffer; index += 1) {

          console.log(given_typed_array[index]);
      }
  }

  function process_microphone_buffer(event) { // invoked by event loop

      var i, N, inp, microphone_output_buffer;

      microphone_output_buffer = event.inputBuffer.getChannelData(0); // just mono - 1 channel for now

      // microphone_output_buffer  <-- this buffer contains current gulp of data size BUFF_SIZE

      show_some_data(microphone_output_buffer, 5, "from getChannelData");
  }

  function start_microphone(stream){

    gain_node = audioContext.createGain();
    gain_node.connect( audioContext.destination );

    microphone_stream = audioContext.createMediaStreamSource(stream);
    microphone_stream.connect(gain_node); 

    script_processor_node = audioContext.createScriptProcessor(BUFF_SIZE, 1, 1);
    script_processor_node.onaudioprocess = process_microphone_buffer;

    microphone_stream.connect(script_processor_node);

    // --- setup FFT

    script_processor_fft_node = audioContext.createScriptProcessor(2048, 1, 1);
    script_processor_fft_node.connect(gain_node);

    analyserNode = audioContext.createAnalyser();
    analyserNode.smoothingTimeConstant = 0;
    analyserNode.fftSize = 2048;

    microphone_stream.connect(analyserNode);

    analyserNode.connect(script_processor_fft_node);

    script_processor_fft_node.onaudioprocess = processAudio;
  }

  function processAudio(e) {
    var buffer = e.inputBuffer.getChannelData(0);
    var out = e.outputBuffer.getChannelData(0);
    var amp = 0;
  
    // Iterate through buffer to get the max amplitude for this frame
    for (var i = 0; i < buffer.length; i++) {
      var loud = Math.abs(buffer[i]);
      if(loud > amp) {
        amp = loud;
      }
      // write input samples to output unchanged
      out[i] = buffer[i];
    }
  
    circleSize = amp*getRandomInt(circleSizeRange[0], circleSizeRange[1]);
    squareSize = amp*getRandomInt(squareSizeRange[0], squareSizeRange[1]);
  }

}; //  webaudio_tooling_obj = function()