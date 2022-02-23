
const sketch = function(p) {
    const BASE_URL = 'https://storage.googleapis.com/quickdraw-models/sketchRNN/models/';
    const availableModels = ['bird', 'ant','ambulance','angel','alarm_clock','antyoga','backpack','barn','basket','bear','bee','beeflower','bicycle','book','brain','bridge','bulldozer','bus','butterfly','cactus','calendar','castle','cat','catbus','catpig','chair','couch','crab','crabchair','crabrabbitfacepig','cruise_ship','diving_board','dog','dogbunny','dolphin','duck','elephant','elephantpig','everything','eye','face','fan','fire_hydrant','firetruck','flamingo','flower','floweryoga','frog','frogsofa','garden','hand','hedgeberry','hedgehog','helicopter','kangaroo','key','lantern','lighthouse','lion','lionsheep','lobster','map','mermaid','monapassport','monkey','mosquito','octopus','owl','paintbrush','palm_tree','parrot','passport','peas','penguin','pig','pigsheep','pineapple','pool','postcard','power_outlet','rabbit','rabbitturtle','radio','radioface','rain','rhinoceros','rifle','roller_coaster','sandwich','scorpion','sea_turtle','sheep','skull','snail','snowflake','speedboat','spider','squirrel','steak','stove','strawberry','swan','swing_set','the_mona_lisa','tiger','toothbrush','toothpaste','tractor','trombone','truck','whale','windmill','yoga','yogabicycle'];
    let model;
    
    // Model
    let modelState;   // store the hidden states of model's neurons
    const temperature = 0.1; // controls the amount of uncertainty of the model (모델의 불확실성 양 조절) // Very low so that we draw very well.
    let modelLoaded = false;
    let modelIsActive = false;
    
    // Model pen state (펜 위치 상태 모델)
    let dx, dy;  // offsets of the pen strokes, in pixels
    let x, y;   // absolute coordinates on the screen of where the pen is (펜이 화면에 있는 절대 좌표)
    let startX, startY;  // Keep track of the first point of the last raw line. (선의 시작점)
    let pen = [0,0,0]; // Model pen state, [pen_down, pen_up, pen_end]. ([펜 눌러서 그릴때 값, 그리는 걸 멈췄지만 마우스로 계속 누르고 있을 때 값, 그림이 끝났을때 값])
    let previousPen = [1, 0, 0]; // Previous model pen state. (이전 모델의 펜 상태)
    const PEN = {DOWN: 0, UP: 1, END: 2};   // (펜 상수값)    // keep track of whether pen is touching paper
    const epsilon = 2.0; // to ignore data from user's pen staying in one spot. (사용자의 펜이 한곳에 머무를 때 데이터 무시하는 상수값)
    
    // Human drawing. (사람이 그리는 것에 대한 변수)
    let currentRawLine = [];
    let userPen = 0; // above = 0 or below = 1 the paper.   (종이 위에 위치할 때  0, 종이 아래에 위치할 때  1)
    let previousUserPen = 0;  
    let currentColor = 'black';
    
    // Keep track of everyone's last attempts to that we can reverse them.  (뒤로가기 할 수 있도록 이전에 그린 값 저장)
    let lastHumanStroke;  // encode the human's drawing as a sequence of [dx, dy, penState] strokes (사람이 그린 그림 배열로 표현)
    let lastHumanDrawing; // the actual sequence of lines that the human drew, so we can replay them. (사람이 그렸던 실제 선들의 배열 => replay되돌리기 할 수 있도록)
    let lastModelDrawing = []; // the actual sequence of lines that the model drew, so that we can erase them. (모델이 그렸던 실제 선들의 배열 => 그것들을 지울 수 있게 )
    
    // Don't record mouse events when the splash is open. (시작 안내 div가 열려있을 때 마우스 이벤트 기록하지 않음)
    let splashIsOpen = true;
    
    /*
     * Main p5 code  (p5.js 코드 사용)
     */
    p.setup = function() {
      // Initialize the canvas.  (캔버스 초기화)

      // Element.getBoundingClientRect() 메서드 : 요소의 크기와 뷰포트에 상대적인 위치 정보를 제공하는 DOMRect 객체(사각형의 크기와 위치)를 반환
      const containerSize = document.getElementById('sketch').getBoundingClientRect();
      // 화면 너비
      // Math.floor() 함수 : 주어진 숫자와 같거나 작은 정수 중에서 가장 큰 수를 반환
      const screenWidth = Math.floor(containerSize.width);
      // 화면 높이
      const screenHeight = Math.floor(containerSize.height);
      // 캔버스 생성하고 픽셀단위로 크기 설정 (setup()함수 시작시 한번만 호출해야 함. 2개 이상의 캔버스 필요하다면 createGraphics()이용)
      p.createCanvas(screenWidth, screenHeight);
      // 화면에 나타날 프레임 수를 매 초 단위로 지정 (초당 60번씩 새로고침 시도)
      p.frameRate(60);
  
      // restart함수와 initModel함수 호출
      restart();
      initModel(22);  // Cat!
      
      // 예측할 그림 단어 선택 모델
      // 가능한 모델들 bird, ant...등 이 담긴 상수값 가져와 <option></option>형태로 매핑해준 후 selectModels에 넣어줌
      selectModels.innerHTML = availableModels.map(m => `<option>${m}</option>`).join('');
      // index값 부여
      selectModels.selectedIndex = 22; 
      // selectModels의 값이 바뀌면 initModel에 새로 선택된 model의 index값 대입
      selectModels.addEventListener('change', () => initModel(selectModels.selectedIndex));
      // 휴지통 버튼 클릭시 restart함수 호출
      btnClear.addEventListener('click', restart);
      // 되돌리기 버튼 클릭시 retryMagic함수 호출
      btnRetry.addEventListener('click', retryMagic);
      // 물음표 버튼 누르면,
      btnHelp.addEventListener('click', () => {
        splash.classList.remove('hidden');  // splash에서 hidden 클래스 제거
        splashIsOpen = true;  // 시작 안내 div가 열림
      });
      // 시작 안내 div의 'Let's Go!' 버튼을 누르면,
      btnGo.addEventListener('click', () => {
        splashIsOpen = false;   // 시작 안내 div가 닫힘
        splash.classList.add('hidden'); // splash에 hidden 클래스 삽입
      });
      // 저장하기 버튼 누르면,
      btnSave.addEventListener('click', () => {
        p.saveCanvas('magic-sketchpad', 'jpg');   // 현재 캔버스를 jpg 이미지로 저장
      });
    };
    
    // windowResized() 함수 : 브라우저 창의 크기가 조정될 때마다 한 번씩 호출
    p.windowResized = function () {
      console.log('resize canvas');
      // containerSize 및 스크린 너비, 높이 재지정
      // Element.getBoundingClientRect() 메서드 : 요소의 크기와 뷰포트에 상대적인 위치 정보를 제공하는 DOMRect 객체(사각형의 크기와 위치)를 반환
      const containerSize = document.getElementById('sketch').getBoundingClientRect();
      const screenWidth = Math.floor(containerSize.width);
      const screenHeight = Math.floor(containerSize.height);
      // 사용자가 지정한 너비와 높이로 캔버스 크기를 재조정   
      // 캔버스는 클리어되고, draw() 함수가 곧바로 호출되어 스케치를 재조정된 크기의 캔버스로 다시 렌더링 함
      p.resizeCanvas(screenWidth, screenHeight);
    };
    
    /*
    * Human is drawing. (사람이 그리는 부분 코드)
    */

    // 요소 위에서 마우스 버튼이 눌릴 때마다 한 번씩 호출
    p.mousePressed = function () {
      if (!splashIsOpen && p.isInBounds()) {  // 시작안내페이지가 false이고 캔버스 범위내에 있을 때
        x = startX = p.mouseX;  // 시스템 변수 mouseX : 캔버스 (0,0)에 대한 마우스의 현재 수평 위치를 담음
        y = startY = p.mouseY;  // 시스템 변수 mouseY : 캔버스 (0,0)에 대한 마우스의 현재 수직 위치를 담음
        userPen = 1; // down!   // 종이 위에 펜(마우스) 위치함
  
        modelIsActive = false;
        currentRawLine = [];
        lastHumanDrawing = [];
        previousUserPen = userPen;  // previousUserPen 변수에 현재 userPen 변수 값 대입
        p.stroke(currentColor);   // 그려질 선 또는 도형 윤곽선의 색상을 설정 (현재 색상 변수 값으로 그려짐)
      }
    }
  
    // 마우스 버튼이 놓일 때마다 한 번씩 호출
    p.mouseReleased = function () {
      if (!splashIsOpen && p.isInBounds()) {
        userPen = 0;  // Up!  
        
        // 본질적인 형태를 유지하면서 작은 변동이나 외부 곡선을 제거하여 선을 단순화 // Simplifies line using RDP algorithm
        const currentRawLineSimplified = model.simplifyLine(currentRawLine);
  
        // If it's an accident...ignore it.
        if (currentRawLineSimplified.length > 1) {
          // Encode this line as a stroke, and feed it to the model.
          // lineToStroke() : Convert from a line format to stroke-5
          lastHumanStroke = model.lineToStroke(currentRawLineSimplified, [startX, startY]); 
          encodeStrokes(lastHumanStroke);
        }
        currentRawLine = [];
        previousUserPen = userPen;
      }
    }

    // 마우스 버튼이 눌린 상태에서 움직일 때마다 한 번씩 호출
    p.mouseDragged = function () {
      if (!splashIsOpen && !modelIsActive && p.isInBounds()) {
        const dx0 = p.mouseX - x;   // 현재 마우스 위치의 x좌표 값 - 마우스 누르기 시작한 지점의 x좌표 값
        const dy0 = p.mouseY - y;   // 현재 마우스 위치의 y좌표 값 - 마우스 누르기 시작한 지점의 y좌표 값
        if (dx0*dx0+dy0*dy0 > epsilon*epsilon) { // Only if pen is not in same area.
          dx = dx0;
          dy = dy0;
          userPen = 1;
          if (previousUserPen == 1) { // 드래그 이전에도 그려지고 있었다면, 
            p.line(x, y, x+dx, y+dy); // draw line connecting prev point to current point. (이전 지점에 이어서 그림)
            lastHumanDrawing.push([x, y, x+dx, y+dy]);  // push() 함수 : 현재의 드로잉 스타일 설정과 변형을 저장  // 사람이 마지막으로 그린 스타일 설정과 변형 저장
          }
          x += dx;
          y += dy;
          currentRawLine.push([x, y]);  
        }
        previousUserPen = userPen;
      }
      return false;
    }
  
   /*
    * Model is drawing.
    * draw() 함수 : setup() 함수 직후에 호출
    * 프로그램 실행이 중단되거나 noLoop() 함수가 호출되기 전까지 블록 내에 포함된 코드들을 계속 실행
    * draw() 함수는 자동으로 호출되며, 명시적으로 호출하면 안됨
    */
    p.draw = function() {
      if (!modelLoaded || !modelIsActive) {
        return;
      }
      
      // New state.
      // 맨처음 설정한 변수 값 let pen = [0,0,0], let previousPen = [1, 0, 0];

      pen = previousPen;

      // Using the previous pen states, and hidden state, get next hidden state
      // the below line takes the most CPU power, especially for large models.
      modelState = model.update([dx, dy, ...pen], modelState);    // update() : Updates the RNN, returns the next state.


      // Get the parameters of the probability distribution (pdf) from hidden state. (확률분포 parameter 얻음)
      // pdf : store all the parameters of a mixture-density distribution  (혼합 분포)
      // Optionally adjust the temperature of the pdf here. (pdf의 temperature 선택적으로 조절)
      const pdf = model.getPDF(modelState, temperature);

      // Sample the next pen's states from our probability distribution. (확률 분포에서 다음 펜의 상태를 샘플링)
      [dx, dy, ...pen] = model.sample(pdf);
  
      // If we finished the previous drawing, start a new one.
      if (pen[PEN.END] === 1) {
        console.log('finished this one');
        modelIsActive = false;
      } else {
        // Only draw on the paper if the pen is still touching the paper.
        if (previousPen[PEN.DOWN] === 1) {
          p.line(x, y, x+dx, y+dy);
          lastModelDrawing.push([x, y, x+dx, y+dy]);
        }
        // Update.
        x += dx;
        y += dy;
        previousPen = pen;
      }
    };
  
    // 현재 마우스 클릭 좌표가 캔버스 범위내에 있는지 확인
    p.isInBounds = function () {
      return p.mouseX >= 0 && p.mouseY >= 0 && p.mouseX < p.width && p.mouseY < p.height;
    }
    
    /*
    * Helpers.
    */
    function retryMagic() {
      p.stroke('white');  // 선, 점, 그리고 도형 윤곽선 색상 흰색으로 지정
      p.strokeWeight(6);  // 선, 점, 그리고 도형 윤곽선 두께 6으로 지정
      
      // Undo the previous line the model drew. (모델이 이전에 그린 선들 취소)
      for (let i = 0; i < lastModelDrawing.length; i++) {
        p.line(...lastModelDrawing[i]);
      }
      
      // Undo the previous human drawn. (사람이 이전에 그린 것 취소)
      for (let i = 0; i < lastHumanDrawing.length; i++) {
        p.line(...lastHumanDrawing[i]);
      }
      
      p.strokeWeight(3.0);
      p.stroke(currentColor);
      
      // Redraw the human drawing. (사람이 이전에 그린 것 다시 그림)
      for (let i = 0; i < lastHumanDrawing.length; i++) {
        p.line(...lastHumanDrawing[i]);
      }
      
      // Start again.
      encodeStrokes(lastHumanStroke);
    }
    
    // 화면 재시작 (화면, 설정들 빈 상태로 다시 시작)
    function restart() {
      p.background(255, 255, 255, 255);   // background() 함수 : p5.js 캔버스의 배경색을 설정 (흰색으로 설정)
      p.strokeWeight(3.0);
  
      // Start drawing in the middle-ish of the screen (화면 중간에 그리기 시작)
      startX = x = p.width / 2.0;
      startY = y = p.height / 3.0;
  
      // Reset the user drawing state. (유저 그림 상태 리셋)
      userPen = 1;
      previousUserPen = 0;
      currentRawLine = [];
      strokes = [];
  
      // Reset the model drawing state. (모델 그림 상태 리셋)
      modelIsActive = false;
      previousPen = [0, 1, 0];
    };
  
    // 모델 초기화 함수
    function initModel(index) {
      modelLoaded = false;
      document.getElementById('sketch').classList.add('loading');   // sketch에 loading 클래스 삽입
      
      if (model) {
        model.dispose();  // MonoSynth를 제거하고 리소스/메모리를 확보    // MonoSynth : 소리 합성을 위한 단일 음성
      }
      
      // loads the TensorFlow.js version of sketch-rnn model, with the "availableModels[index]" model's weights.
      // 선택한 모델 단어가 바뀌는 것에 맞춰서 sketchRNN모델의 tensorflow.js version을 로드함 (선택한 단어에 해당하는 값 가져옴)
      model = new ms.SketchRNN(`${BASE_URL}${availableModels[index]}.gen.json`);


      // Loads variables from the JSON model
      model.initialize().then(() => {
        modelLoaded = true;
        document.getElementById('sketch').classList.remove('loading') // sketch에 loading 클래스 삭제
        console.log(`🤖${availableModels[index]} loaded.`);
        model.setPixelFactor(5.0);  // Bigger -> large outputs  // Sets the internal EXTRA factor of this model (pixel to model space)
      });
    };
  
    function encodeStrokes(sequence) {
      if (sequence.length <= 5) {
        return;
      }
  
      // Encode the strokes in the model.
      let newState = model.zeroState();    // Returns the zero/initial state of the model (모델의 0/초기 상태 반환)

      // zeroInput() : Returns the zero input state of the model (모델의 0 입력 상태를 반환)
      newState = model.update(model.zeroInput(), newState);  
      // Updates the RNN on a series of Strokes, returns the next state. (일련의 strokes에서 RNN 업데이트 하고, 다음 상태 반환)
      newState = model.updateStrokes(sequence, newState, sequence.length-1); 

  
      // Reset the actual model we're using to this one that has the encoded strokes. (사용하고 있는 실제 모델을 인코딩된 strokes가 있는 모델로 재설정)
      modelState = model.copyState(newState);   // copyState() : Returns a new copy of the rnn state

      
      const lastHumanLine = lastHumanDrawing[lastHumanDrawing.length-1];
      x = lastHumanLine[0];
      y = lastHumanLine[1];
  
      // Update the pen state.
      const s = sequence[sequence.length-1];
      dx = s[0];
      dy = s[1];
      previousPen = [s[2], s[3], s[4]];
  
      lastModelDrawing = [];
      modelIsActive = true;
    }
    
    /*
    * Colours.  색상
    */
    const COLORS = [
      { name: 'black', hex: '#000000'},
      { name: 'red', hex: '#f44336'},
      { name: 'pink', hex: '#E91E63'},
      { name: 'purple', hex: '#9C27B0'},
      { name: 'deeppurple', hex: '#673AB7'},
      { name: 'indigo', hex: '#3F51B5'},
      { name: 'blue', hex: '#2196F3'},
      { name: 'cyan', hex: '#00BCD4'},
      { name: 'teal', hex: '#009688'},
      { name: 'green', hex: '#4CAF50'},
      { name: 'lightgreen', hex: '#8BC34A'},
      { name: 'lime', hex: '#CDDC39'},
      { name: 'yellow', hex: '#FFEB3B'},
      { name: 'amber', hex: '#FFC107'},
      { name: 'orange', hex: '#FF9800'},
      { name: 'deeporange', hex: '#FF5722'},
      { name: 'brown', hex: '#795548'},
      { name: 'grey', hex: '#9E9E9E'}
    ];
    
    function randomColor() {    // 랜덤 색상으로도 설정 가능
      return COLORS[Math.floor(Math.random() * COLORS.length)].hex
    }
    function randomColorIndex() {   // 랜덤 색상으로 설정시 인덱스 값
      return Math.floor(Math.random() * COLORS.length);
    }
    // Assign the current cursor position as currently selected color. (현재 커서 위치를 현재 선택한 색상으로 지정)
    p.updateCurrentColor = function(index) {  
      currentColor = COLORS[index].hex;
    }
  
  };
  
  // 아래 코드와 같은 인스턴스를 만들면 각각 자체 설정 변수로 마무리되므로 단일 웹 페이지에 여러개 p5 스케치 존재 가능
  const p5Sketch = new p5(sketch, 'sketch');
  function changeColor(event){
    const btn = event.target;
    p5Sketch.updateCurrentColor(btn.dataset.index);
    document.querySelector('.active').classList.remove('active');
    btn.classList.add('active');
  }