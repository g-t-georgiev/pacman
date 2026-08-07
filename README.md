# 🟡 Pac-Man Clone (HTML5 + JavaScript)

A classic arcade-style Pac-Man game built using JavaScript and the HTML5 Canvas API. Navigate the maze, collect pellets, avoid ghosts, and beat your high score!

## 🎮 Gameplay Features

- Grid-based maze with walls, pellets, and power-ups
- Player-controlled Pac-Man with smooth directional movement
- AI-driven ghosts with simple pathfinding
- Power pellets that let you eat ghosts temporarily
- Score tracking and lives system
- Customizable map layout and characters

## 🚀 Demo

> Link to live demo:
> a github pages setup [here](https://g-t-georgiev.github.io/pacman/)

## 🛠️ Technologies Used

- **JavaScript (ES6+)**
- **HTML5 Canvas API**
- No external libraries or frameworks — pure vanilla JS!

## 📁 Project Structure

```
root/
├── .githooks/
│   └── pre-push
├── .vscode/
│   └── extensions.json
├── assets/
│   ├── fonts/
│   └── images/
├── src/
│   ├── components/
│   │   ├── Actor.js                    # Shared base class for Pac-Man & ghosts
│   │   ├── Boundary.js                 # Ghost AI and rendering
│   │   ├── Ghost.js                    # Maze walls and boundaries
│   │   ├── Pacman.js                   # Pac-Man behavior and animation
│   │   ├── Pellet.js                   # Regular pellet/dot logic
│   │   ├── PowerPellet.js              # Power pellet/energizer logic
│   │   ├── Tile.js                     # Tile types (walls, pellets, etc.)
│   │   └── Tilemap.js                  # Maze generation from layout
│   ├── helpers/
│   │   └── svgPathConverter.js
│   ├── collisions.js                   # Collision detection logic
│   ├── constants.js                    # Game constants (tile size, colors, speed)
│   ├── Loader.js                       # Asset preloader (images, sounds)
│   ├── main.js                         # Main game loop and orchestration
│   ├── mazeLayout.json                 # 1D array data file for maze grid layout
│   ├── mazeLayout.txt                  # 1D array text helper file
│   ├── styles.css
│   └── utils.js
├── .editorconfig
├── .gitattributes
├── .gitignore
├── favicon.ico
├── index.html
├── LICENSE
├── package.json
└── README.md
```

## 🎮 Controls

- **Arrow keys / WASD** – Move Pac-Man
- **R** – Restart game (to be implemented)
- **P** – Pause/resume (to be implemented)

## 📸 Screenshots

> _(Add screenshots or a GIF of gameplay here)_

## 🎨 Design

- Canvas API: All drawing and animation done with canvas.getContext('2d')
- Scalable tile-based system: Driven by mazeLayout.json and tilemap.js
- Custom ghost and player rendering using modular components

## 🧠 AI Overview (Ghosts)

Each ghost has a different behavior:
- **Chase Mode:** Follows the player
- **Scatter Mode:** Retreats to corners
- **Frightened Mode:** Moves randomly when vulnerable

You can extend each ghost's AI individually in the `ghost.js` file.

---

## 📦 Installation

No build tools or frameworks required — it's 100% browser-based.

1. Clone the repository:

```bash
   git clone https://github.com/g-t-georgiev/pacman.git
   cd pacman
```

2. Open index.html in your browser.
3. No server required – runs fully in the browser!

---

## 🔮 Future Enhancements (WIP)

- Level progression with multiple levels and increasing difficulty
- High score leaderboard (local or online)
- Mobile touch controls
- Sound effects and music
- Custom map editor
- Touch controls for mobile
- Leaderboard using local storage or backend

## 🧑‍💻 Contributing

Pull requests and suggestions are welcome! Please fork the repo and submit a PR or open an issue to discuss changes.

## 📄 License

MIT License

---

Built with ❤️ using JavaScript + Canvas