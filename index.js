const replay = document.getElementById("replay");
const domScore = document.getElementById("score");
const canvasGame = document.createElement("canvas");
const muteMusic = document.getElementById("muteMusic");
const muteSound = document.getElementById("muteSound");
const increaseVolume = document.getElementById("increaseVolume");
const lowerVolume = document.getElementById("lowerVolume");

document.querySelector("#canvas").appendChild(canvasGame);

const ctx = canvasGame.getContext("2d");

const W = (canvasGame.width = 400);
const H = (canvasGame.height = 400);

let snake,
food, 
currentHue, 
cells = 20,
cellsSize,
isGameOver = false,
tails = [],
score = 00,
maxScore = window.localStorage.getItem("maxScore") || undefined,
particles = [],
splashingParticleCount = 20,
cellsCount,
requestID,
backgroundMusic,
gameOverSound,
growSound;

let helpers = {
   Vec: class {
      constructor (x,y) {
         this.x = x;
         this.y = y;
      }

      add(v) {
         this.x += v.x;
         this.y += v.y;
         return this;
      }

      mult(v) {
         if(v instanceof helpers.Vec) {
            this.x *= v.x;
            this.y *= v.y;
            return this;
         }

         this.x *= v;
         this.y *= v;
         return this;
      }
   },
   isCollision(v1, v2) {
      return v1.x == v2.x && v1.y == v2.y;
   },
   garbageCollector() {
      for(let i = 0; i < particles.length; i++) {
         if(particles[i].size <= 0) {
            particles.splice(i, 1);
         }
      }
   }, 
   drawGrid() {
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = "#232332";
      ctx.shadowBlur = 0;

      for (let i = 0; i < cells; i++) {
         let f = (W / cells) * i;

         ctx.beginPath();
         ctx.moveTo(f, 0);
         ctx.lineTo(f, H);
         ctx.stroke();
         ctx.beginPath();
         ctx.moveTo(0, f);
         ctx.lineTo(W, f);
         ctx.stroke();
         ctx.closePath();
      }
   },
   randHue() {
      return ~~(Math.random() * 360);
   },
   hsl2rgb(hue, saturation, lightness) {
      if (hue == undefined) {
         return [0, 0, 0];
      }
      let chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
      let huePrime = hue / 60;
      let secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

      huePrime = ~~huePrime;
      let red;
      let green;
      let blue;

      if (huePrime === 0) {
         red = chroma;
         green = secondComponent;
         blue = 0;
      }
      else if (huePrime === 1) {
         red = secondComponent;
         green = chroma;
         blue = 0;
      }
      else if (huePrime === 2) {
         red = 0;
         green = chroma;
         blue = secondComponent;
      }
      else if (huePrime === 3) {
         red = 0;
         green = secondComponent;
         blue = chroma;
      }
      else if (huePrime === 4) {
         red = secondComponent;
         green = 0;
         blue = chroma;
      }
      else if (huePrime === 5) {
         red = chroma;
         green = 0;
         blue = secondComponent;
      }

      let lightnessAjudstment = lightness - chroma / 2;
      red += lightnessAjudstment;
      green += lightnessAjudstment;
      blue += lightnessAjudstment;

      return [
         Math.round(red * 255),
         Math.round(green * 255),
         Math.round(blue * 255)
      ];
   },
   lerp(start, end, t) {
      return start * (1 - t) + end * t;
   }
};

let KEY = {
   ArrowUp: false,
   ArrowRight: false,
   ArrowDown: false,
   ArrowLeft: false,
   w: false,
   a: false,
   s: false,
   d: false,
   resetState() {
      this.ArrowUp = false;
      this.ArrowRight = false;
      this.ArrowDown = false;
      this.ArrowLeft = false;
      this.w = false;
      this.a = false;
      this.s = false;
      this.d = false;
   },

   listen() {
      addEventListener("keydown", (e) => {
         if (e.key === "ArrowUp" && this.ArrowDown || e.key === "w" && this.s) return;
         if (e.key === "ArrowDown" && this.ArrowUp || e.key === "s" && this.w) return;
         if (e.key === "ArrowLeft" && this.ArrowRight || e.key === "a" && this.d) return;
         if (e.key === "ArrowRight" && this.ArrowLeft || e.key === "d" && this.a) return;
         this[e.key] = true;

         Object.keys(this)
            .filter((f) => f !== e.key && f !== "listen" && f !== "resetState")
            .forEach((k) => {
               this[k] = false;
            }); 
      },
      false
      );     
   }
};

class Snake {
   constructor(i, type) {
      this.pos = new helpers.Vec(W / 2, H / 2);
      this.dir = new helpers.Vec(0, 0);
      this.type = type;
      this.index = i;
      this.delay = 5;
      this.size = W / cells;
      this.color = "white";
      this.history = [];
      this.total = 1;
   }

   draw() {
      let{x , y}  = this.pos;
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "rgba(255,255,255,.3)";
      ctx.fillRect(x, y, this.size, this.size);
      ctx.shadowBlur = 0;
      if (this.total >= 2) {
         for (let i = 0; i < this.history.length - 1; i++) {
            let {x, y} = this.history[i];
            ctx.lineWidth = 1;
            ctx.fillStyle = "rgba(255,255,255,1)";
            ctx.fillRect(x, y, this.size, this.size);
         }
      }
   }

   walls() {
      let {x, y} = this.pos;
      if (x + cellsSize > W) {
         this.pos.x = 0;
      }
      if (y + cellsSize > W) {
         this.pos.y = 0;
      }
      if (y < 0) {
         this.pos.y = H - cellsSize;
      }
      if (x < 0) {
         this.pos.x = W - cellsSize;
      }
   }

   controlls() {
      let dir = this.size;
      if (KEY.ArrowUp || KEY.w) {
         this.dir = new helpers.Vec(0, -dir);
      }
      if (KEY.ArrowDown || KEY.s) {
         this.dir = new helpers.Vec(0, dir);
      }
      if (KEY.ArrowLeft || KEY.a) {
         this.dir = new helpers.Vec(-dir, 0);
      }
      if (KEY.ArrowRight || KEY.d) {
         this.dir = new helpers.Vec(dir, 0);
      }
   }

   selfCollision() {
      for (let i = 0; i < this.history.length; i++) {
         let p = this.history[i];
         if (helpers.isCollision(this.pos, p)) {
            isGameOver = true;
         }
      }
   }

   update() {
      this.walls();
      this.draw();
      this.controlls();
      if (!this.delay--) {
         if (helpers.isCollision(this.pos, food.pos)) {
            growSound = new sound("./sounds/growSound.webm");
            growSound.play();
            incrementScore();
            particleSplash();
            food.spawn();
            this.total++;
         }
         
         this.history[this.total - 1] = new helpers.Vec(this.pos.x, this.pos.y);
         for (let i = 0; i < this.total - 1; i++) {
            this.history[i] = this.history[i + 1];
         }
         this.pos.add(this.dir);
         this.delay = 5;
         this.total > 3 ? this.selfCollision() : null;

         if (this.pos.x < 0 || this.pos.x >= W || this.pos.y < 0 || this.pos.y >= H) {
            isGameOver = true;
         }
      }
   }
};

class Food {
   constructor() {
      this.pos = new helpers.Vec(
         ~~(Math.random() * cells) * cellsSize,
         ~~(Math.random() * cells) * cellsSize
      );
      this.color = currentHue = `hsl(${~~(Math.random() * 360)},100%,50%)`;
      this.size = cellsSize;
   }

   draw() {
      let {x, y} = this.pos;
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 20;
      this.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.fillRect(x, y, this.size, this.size);
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
   }

   spawn() {
      let randX = ~~(Math.random() * cells) * this.size;
      let randY = ~~(Math.random() * cells) * this.size;
      for (let path of snake.history) {
         if (helpers.isCollision(new helpers.Vec(randX, randY), path)) {
            return this.spawn();
         }
      }
      this.color = currentHue = `hsl(${helpers.randHue()}, 100%, 50%)`;
      this.pos = new helpers.Vec(randX, randY);
   }
};

class Particle {
   constructor(pos, color, size, vel) {
      this.pos = pos;
      this.color = color;
      this.size = Math.abs(size / 2);
      this.ttl = 0;
      this.gravity = -0.2;
      this.vel = vel;
   }

   draw() {
      let {x, y} = this.pos;
      let hsl = this.color
         .split("")
         .filter((l) => l.match(/[^hsl()$% ]/g))
         .join("")
         .split(",")
         .map((n) => +n);
      let [r, g, b] = helpers.hsl2rgb(hsl[0], hsl[1] / 100, hsl[2] / 100);
      ctx.shadowColor = `rgb(${r},${g},${b},${1})`;
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgb(${r},${g},${b},${1})`;
      ctx.fillRect(x, y, this.size, this.size);
      ctx.globalCompositeOperation = 'source-over';
   }

   update() {
      this.draw();
      this.size -= 0.3;
      this.ttl += 1;
      this.pos.add(this.vel);
      this.vel.y -= this.gravity;
   }
};

class sound {
   constructor(src) {
      this.sound = document.createElement("audio");
      this.sound.src = src;
      this.sound.setAttribute("preload", "auto");
      this.sound.setAttribute("controls", "mute");  
      this.sound.style.display = "none";
      document.body.appendChild(this.sound);
      this.play = function () {
         this.sound.play();
      };
      this.stop = function () {
         this.sound.pause();
      };
   }

   lowerVolume(amount) {
      if (this.sound.volume >= amount) {
         this.sound.volume -= amount;
      } else {
         this.sound.volume = 0;
      }
   }
   
   increaseVolume(amount) {
      if (this.sound.volume + amount <= 1) {
         this.sound.volume += amount;
      } else {
         this.sound.volume = 1;
      }
   }
};

function incrementScore() {
   score++;
   domScore.innerText = score.toString().padStart(2, "0");
};

function particleSplash() {
   for (let i = 0; i < splashingParticleCount; i++) {
      let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3);
      let position = new helpers.Vec(food.pos.x, food.pos.y);
      particles.push(new Particle(position, currentHue, food.size, vel));
   }
};

function clear() {
   ctx.clearRect(0, 0, W, H);
};

function gameOver() {
   maxScore ? null : (maxScore = score);
   score > maxScore ? (maxScore = score) : null;
   window.localStorage.setItem("maxScore", maxScore);
   ctx.fillStyle = "#4cffd7";
   ctx.textAlign = "center";
   ctx.font = "bold 30px Poppins, sans-serif";
   ctx.fillText("GAME OVER!", W / 2, H / 2);
   ctx.font = "15px Poppins, sans-serif";
   ctx.fillText(`SCORE  ${score}`, W / 2, H / 2 + 60);
   ctx.fillText(`MAXSCORE  ${maxScore}`, W / 2, H / 2 + 80);
   gameOverSound = new sound("./sounds/gameOver.webm");
   gameOverSound.play();
   replay.classList.add("active");
};

function loop() {
   clear();
   if (!isGameOver) {
      requestID = setTimeout(loop, 1000 / 60);
      helpers.drawGrid();
      snake.update();
      food.draw();
      for (let p of particles) {
         p.update();
      }
      helpers.garbageCollector(); 
   }
   else {
      clear();
      gameOver();
   }
};

muteMusic.addEventListener("click", () => {
   const isMuted = backgroundMusic.sound.muted;
   backgroundMusic.sound.muted = !isMuted;

   const checkIsMuted = document.getElementById('checkIsMuted');

   if (backgroundMusic.sound.muted) {
      checkIsMuted.src = "./assets/music-off.svg";
   } else {
      checkIsMuted.src = "./assets/music.svg";
   }
});

document.addEventListener("keydown", () => {
   backgroundMusic.play();
});

function reset() {
   domScore.innerText == "00";
   score = "00";
   snake = new Snake();
   food.spawn();
   KEY.resetState();
   isGameOver = false;
   clearTimeout(requestID);
   replay.classList.remove("active");
   loop();
};

function initialize() {
   ctx.imageSmoothingEnabled = false;
   KEY.listen();
   cellsCount = cells * cells;
   cellsSize = W / cells;
   snake = new Snake();
   food = new Food();
   replay.addEventListener('click', reset, false);
   backgroundMusic = new sound("./sounds/backgroundMusic.webm");
   backgroundMusic.play();
   loop();
};

initialize();