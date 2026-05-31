import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Sliders, 
  Compass, 
  Globe, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Info, 
  ChevronRight,
  Eye,
  Zap,
  Activity,
  X,
  Sparkles,
  RefreshCw,
  Settings,
  Flame,
  Snowflake,
  Sun
} from 'lucide-react';


// --- MOTOR DE ÁUDIO SINTETIZADO ---
class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playLaunch(mass) {
    if (this.muted) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const freq = Math.max(100, 800 - Math.log10(mass) * 120);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq / 2, this.ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch (e) {}
  }

  playCollision(mass1, mass2) {
    if (this.muted) return;
    this.init();
    try {
      const noise = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      noise.connect(gain);
      gain.connect(this.ctx.destination);

      const totalMass = mass1 + mass2;
      const freq = Math.max(60, 400 - Math.log10(totalMass) * 50);

      noise.type = 'sawtooth';
      noise.frequency.setValueAtTime(freq, this.ctx.currentTime);
      noise.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);

      noise.disconnect(gain);
      noise.connect(filter);
      filter.connect(gain);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

      noise.start();
      noise.stop(this.ctx.currentTime + 0.5);
    } catch (e) {}
  }

  playSelect() {
    if (this.muted) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, this.ctx.currentTime);
      osc.frequency.setValueAtTime(850, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {}
  }
}

const sounds = new SoundController();

export default function App() {
  // --- ESTADOS GERAIS DE INTERFACE ---
  const [showWelcome, setShowWelcome] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [gravitationalConstant, setGravitationalConstant] = useState(0.2);
  const [timeStep, setTimeStep] = useState(1);
  const [activeTab, setActiveTab] = useState('presets'); // presets | custom | stats
  const [selectedBodyType, setSelectedBodyType] = useState('planet'); // star | planet | moon | custom
  const [trailLength, setTrailLength] = useState(200);
  const [isMuted, setIsMuted] = useState(false);
  const [fps, setFps] = useState(60);

  // --- CONFIGURAÇÃO DO CRIADOR CUSTOMIZADO ---
  const [customMass, setCustomMass] = useState(150);
  const [customRadius, setCustomRadius] = useState(12);
  const [customColor, setCustomColor] = useState('#38bdf8');
  const [customName, setCustomName] = useState('Érebo');
  const [customStyle, setCustomStyle] = useState('rocky'); // rocky | gas | ice | lava
  const [customBrightness, setCustomBrightness] = useState(100);
  const [customSaturation, setCustomSaturation] = useState(100);

  // --- ASTRO-INSPETOR (PAINEL DIREITO) ---
  const [selectedBodyId, setSelectedBodyId] = useState(null);

  // --- REFERÊNCIAS ---
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const bodiesRef = useRef([]);
  
  // Medidores de performance e FPS
  const lastTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  
  // Câmera Pan & Zoom
  const [zoom, setZoom] = useState(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingCamera = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Criação interativa com vetor de lançamento por empuxo
  const isDrawingVector = useRef(false);
  const vectorStart = useRef({ x: 0, y: 0 });
  const vectorEnd = useRef({ x: 0, y: 0 });
  const predictionPointsRef = useRef([]);

  // Métricas de simulação
  const [stats, setStats] = useState({
    bodyCount: 0,
    totalMass: 0,
    kineticEnergy: 0,
    potentialEnergy: 0
  });

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // --- REFS SÍNCRONAS PARA GARANTIR 60 FPS SEM REMONTAGEM DE LOOP ---
  const isPlayingRef = useRef(isPlaying);
  const showGridRef = useRef(showGrid);
  const showVectorsRef = useRef(showVectors);
  const showPathsRef = useRef(showPaths);
  const gravitationalConstantRef = useRef(gravitationalConstant);
  const timeStepRef = useRef(timeStep);
  const zoomRef = useRef(zoom);
  const trailLengthRef = useRef(trailLength);
  const selectedBodyIdRef = useRef(selectedBodyId);
  const dimensionsRef = useRef(dimensions);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useEffect(() => { showVectorsRef.current = showVectors; }, [showVectors]);
  useEffect(() => { showPathsRef.current = showPaths; }, [showPaths]);
  useEffect(() => { gravitationalConstantRef.current = gravitationalConstant; }, [gravitationalConstant]);
  useEffect(() => { timeStepRef.current = timeStep; }, [timeStep]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { trailLengthRef.current = trailLength; }, [trailLength]);
  useEffect(() => { selectedBodyIdRef.current = selectedBodyId; }, [selectedBodyId]);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);

  // Função para silenciar áudio
  const toggleMute = () => {
    sounds.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const presets = {
    solar_system: {
      name: "Sistema Solar Simulado",
      desc: "Uma estrela amarela de alta massa com planetas em trajetórias elípticas estáveis.",
      bodies: [
        { id: '1', name: "Sol", x: 0, y: 0, vx: 0, vy: 0, mass: 15000, radius: 26, color: "#eab308", fixed: true, trail: [], style: 'star', brightness: 120, saturation: 110 },
        { id: '2', name: "Mercúrio", x: 0, y: -80, vx: 6.2, vy: 0, mass: 12, radius: 5, color: "#94a3b8", fixed: false, trail: [], style: 'rocky', brightness: 90, saturation: 50 },
        { id: '3', name: "Vênus", x: 0, y: -130, vx: 4.8, vy: 0, mass: 80, radius: 9, color: "#f97316", fixed: false, trail: [], style: 'lava', brightness: 100, saturation: 100 },
        { id: '4', name: "Terra", x: 0, y: -190, vx: 4.0, vy: 0, mass: 120, radius: 10, color: "#3b82f6", fixed: false, trail: [], style: 'ice', brightness: 110, saturation: 120 },
        { id: '5', name: "Marte", x: 0, y: -250, vx: 3.5, vy: 0, mass: 55, radius: 7, color: "#ef4444", fixed: false, trail: [], style: 'rocky', brightness: 100, saturation: 100 },
      ]
    },
    binary_stars: {
      name: "Estrelas Binárias",
      desc: "Dois sóis orbitando cooperativamente em torno de seu baricentro mútuo.",
      bodies: [
        { id: '11', name: "Sólis Alfa", x: -95, y: 0, vx: 0, vy: 3.1, mass: 6000, radius: 19, color: "#f43f5e", fixed: false, trail: [], style: 'star', brightness: 120, saturation: 110 },
        { id: '12', name: "Sólis Beta", x: 95, y: 0, vx: 0, vy: -3.1, mass: 6000, radius: 19, color: "#fb7185", fixed: false, trail: [], style: 'star', brightness: 110, saturation: 120 },
        { id: '13', name: "Vagante S-42", x: 0, y: -210, vx: 2.2, vy: 0, mass: 15, radius: 6, color: "#10b981", fixed: false, trail: [], style: 'ice', brightness: 100, saturation: 100 },
      ]
    },
    three_body: {
      name: "Problema de 3 Corpos",
      desc: "Alinhamento hipercrítico e caótico de três massas estelares equivalentes.",
      bodies: [
        { id: '21', name: "Próxima A", x: -140, y: -60, vx: 1.4, vy: -1.9, mass: 4500, radius: 15, color: "#a855f7", fixed: false, trail: [], style: 'gas', brightness: 100, saturation: 100 },
        { id: '22', name: "Próxima B", x: 140, y: -60, vx: -1.4, vy: -1.9, mass: 4500, radius: 15, color: "#ec4899", fixed: false, trail: [], style: 'gas', brightness: 100, saturation: 100 },
        { id: '23', name: "Próxima C", x: 0, y: 120, vx: 0, vy: 3.8, mass: 4500, radius: 15, color: "#06b6d4", fixed: false, trail: [], style: 'gas', brightness: 100, saturation: 100 }
      ]
    },
    black_hole: {
      name: "Abismo do Espaço-Tempo",
      desc: "Um buraco negro massivo sugando matéria de sua vizinhança estelar imediata.",
      bodies: [
        { id: '31', name: "Singularidade", x: 0, y: 0, vx: 0, vy: 0, mass: 50000, radius: 14, color: "#000000", fixed: true, trail: [], style: 'blackhole', brightness: 100, saturation: 100 },
        { id: '32', name: "Estrela Azul", x: -200, y: -30, vx: 5.8, vy: -2.0, mass: 250, radius: 9, color: "#38bdf8", fixed: false, trail: [], style: 'star', brightness: 130, saturation: 120 },
        { id: '33', name: "Planeta Rochoso", x: 230, y: 120, vx: -3.9, vy: 2.2, mass: 40, radius: 6, color: "#fb923c", fixed: false, trail: [], style: 'rocky', brightness: 80, saturation: 80 },
        { id: '34', name: "Asteroide Gelado", x: -150, y: 180, vx: 3.4, vy: 2.8, mass: 5, radius: 4, color: "#e2e8f0", fixed: false, trail: [], style: 'ice', brightness: 90, saturation: 50 }
      ]
    }
  };

  const loadPreset = (presetKey) => {
    sounds.playSelect();
    const preset = presets[presetKey];
    if (preset) {
      bodiesRef.current = preset.bodies.map(b => ({
        ...b,
        trail: []
      }));
      setZoom(1.0);
      panRef.current = { x: 0, y: 0 };
      setSelectedBodyId(null);
    }
  };

  const blendColors = (color1, mass1, color2, mass2) => {
    const hexToRgb = (hex) => {
      const sh = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return sh ? [parseInt(sh[1], 16), parseInt(sh[2], 16), parseInt(sh[3], 16)] : [100, 100, 100];
    };
    const rgbToHex = (r, g, b) => "#" + [r, g, b].map(x => {
      const hex = Math.min(255, Math.max(0, Math.round(x))).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
    
    try {
      const rgb1 = hexToRgb(color1);
      const rgb2 = hexToRgb(color2);
      const total = mass1 + mass2;
      const r = (rgb1[0] * mass1 + rgb2[0] * mass2) / total;
      const g = (rgb1[1] * mass1 + rgb2[1] * mass2) / total;
      const b = (rgb1[2] * mass1 + rgb2[2] * mass2) / total;
      return rgbToHex(r, g, b);
    } catch (e) {
      return color1;
    }
  };

  // --- CALCULAR PREVISÃO DE ÓRBITA DA PROJEÇÃO ---
  const calculatePrediction = (startX, startY, vx, vy, mass) => {
    let tx = startX;
    let ty = startY;
    let tvx = vx;
    let tvy = vy;
    const points = [];
    const bodies = bodiesRef.current;
    
    for (let step = 0; step < 120; step++) {
      let ax = 0;
      let ay = 0;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const dx = b.x - tx;
        const dy = b.y - ty;
        const distSqr = dx * dx + dy * dy;
        const dist = Math.sqrt(distSqr);
        
        if (dist < (b.radius + 2)) continue;
        
        const force = (gravitationalConstantRef.current * mass * b.mass) / distSqr;
        ax += (force * dx) / (dist * mass);
        ay += (force * dy) / (dist * mass);
      }
      
      tvx += ax * timeStepRef.current;
      tvy += ay * timeStepRef.current;
      tx += tvx * timeStepRef.current;
      ty += tvy * timeStepRef.current;
      
      if (step % 2 === 0) {
        points.push({ x: tx, y: ty });
      }
    }
    predictionPointsRef.current = points;
  };

  // --- GARANTE RE-DIMENSIONAMENTO COMPLETO APÓS FECHAR OU ABRIR PAINÉIS ---
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('canvas-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };
    
    const timer = setTimeout(handleResize, 320); // aguarda a transição de CSS dos painéis fechar
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [leftPanelOpen, selectedBodyId]);


  // --- LOOP GRÁFICO E FÍSICO COM REFS - 60 FPS CRAVADO ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const updatePhysics = () => {
      if (!isPlayingRef.current) return;

      const bodies = bodiesRef.current;
      const n = bodies.length;
      
      const ax = new Array(n).fill(0);
      const ay = new Array(n).fill(0);

      // Interações de Gravidade
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const b1 = bodies[i];
          const b2 = bodies[j];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const distSqr = dx * dx + dy * dy;
          const dist = Math.sqrt(distSqr);

          const minDist = b1.radius + b2.radius;
          if (dist < minDist) continue;

          const force = (gravitationalConstantRef.current * b1.mass * b2.mass) / distSqr;
          const fx = (force * dx) / dist;
          const fy = (force * dy) / dist;

          if (!b1.fixed) {
            ax[i] += fx / b1.mass;
            ay[i] += fy / b1.mass;
          }
          if (!b2.fixed) {
            ax[j] -= fx / b2.mass;
            ay[j] -= fy / b2.mass;
          }
        }
      }

      // Atualizar vetores de velocidade/posição
      for (let i = 0; i < n; i++) {
        const b = bodies[i];
        if (b.fixed) continue;

        b.vx += ax[i] * timeStepRef.current;
        b.vy += ay[i] * timeStepRef.current;
        b.x += b.vx * timeStepRef.current;
        b.y += b.vy * timeStepRef.current;

        if (showPathsRef.current) {
          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > trailLengthRef.current) {
            b.trail.shift();
          }
        } else {
          b.trail = [];
        }
      }

      // Resolver Impactos Cósmicos e Fusões
      const mergedIndices = new Set();
      for (let i = 0; i < n; i++) {
        if (mergedIndices.has(i)) continue;
        for (let j = i + 1; j < n; j++) {
          if (mergedIndices.has(j)) continue;

          const b1 = bodies[i];
          const b2 = bodies[j];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < (b1.radius + b2.radius)) {
            const [major, minor, majorIdx, minorIdx] = b1.mass >= b2.mass 
              ? [b1, b2, i, j] 
              : [b2, b1, j, i];

            sounds.playCollision(major.mass, minor.mass);

            if (!major.fixed) {
              major.vx = (major.mass * major.vx + minor.mass * minor.vx) / (major.mass + minor.mass);
              major.vy = (major.mass * major.vy + minor.mass * minor.vy) / (major.mass + minor.mass);
            }

            major.x = (major.mass * major.x + minor.mass * minor.x) / (major.mass + minor.mass);
            major.y = (major.mass * major.y + minor.mass * minor.y) / (major.mass + minor.mass);

            major.color = blendColors(major.color, major.mass, minor.color, minor.mass);
            major.mass += minor.mass;
            major.radius = Math.min(80, Math.pow(Math.pow(major.radius, 3) + Math.pow(minor.radius, 3), 1/3));

            if (minor.id === selectedBodyIdRef.current) {
              setSelectedBodyId(major.id);
            }

            mergedIndices.add(minorIdx);
          }
        }
      }

      if (mergedIndices.size > 0) {
        bodiesRef.current = bodies.filter((_, idx) => !mergedIndices.has(idx));
      }

      calculateMetrics();
    };

    const calculateMetrics = () => {
      const bodies = bodiesRef.current;
      let totalM = 0;
      let totalKe = 0;
      let totalPe = 0;

      for (let i = 0; i < bodies.length; i++) {
        const b1 = bodies[i];
        totalM += b1.mass;
        const vSqr = b1.vx * b1.vx + b1.vy * b1.vy;
        totalKe += 0.5 * b1.mass * vSqr;

        for (let j = i + 1; j < bodies.length; j++) {
          const b2 = bodies[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          // CORRIGIDO: Fechamento correto de parênteses no cálculo da raiz quadrada da distância
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            totalPe -= (gravitationalConstantRef.current * b1.mass * b2.mass) / dist;
          }
        }
      }

      setStats({
        bodyCount: bodies.length,
        totalMass: Math.round(totalM),
        kineticEnergy: Math.round(totalKe),
        potentialEnergy: Math.round(totalPe)
      });
    };

    const drawProceduralTexture = (ctx, b) => {
      ctx.save();
      
      const sat = b.saturation !== undefined ? b.saturation : 100;
      const brt = b.brightness !== undefined ? b.brightness : 100;
      ctx.filter = `saturate(${sat}%) brightness(${brt}%)`;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.clip();

      const type = b.style || 'rocky';

      if (type === 'star') {
        const grad = ctx.createRadialGradient(b.x - b.radius*0.2, b.y - b.radius*0.2, b.radius*0.1, b.x, b.y, b.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, '#fef08a');
        grad.addColorStop(0.6, b.color);
        grad.addColorStop(1, '#ea580c');
        ctx.fillStyle = grad;
        ctx.fill();
      } 
      else if (type === 'blackhole') {
        ctx.fillStyle = '#000000';
        ctx.fill();
      } 
      else if (type === 'gas') {
        ctx.fillStyle = b.color;
        ctx.fill();
        
        const stripes = [-0.6, -0.2, 0.2, 0.6];
        stripes.forEach((pos, i) => {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)';
          ctx.fillRect(b.x - b.radius, b.y + (pos * b.radius) - (b.radius*0.15), b.radius * 2, b.radius * 0.3);
        });
      } 
      else if (type === 'lava') {
        ctx.fillStyle = '#b91c1c';
        ctx.fill();

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = b.radius * 0.15;
        ctx.beginPath();
        ctx.moveTo(b.x - b.radius, b.y + b.radius*0.2);
        ctx.quadraticCurveTo(b.x, b.y - b.radius*0.4, b.x + b.radius, b.y + b.radius*0.1);
        ctx.moveTo(b.x - b.radius*0.8, b.y - b.radius*0.3);
        ctx.lineTo(b.x + b.radius*0.5, b.y + b.radius*0.6);
        ctx.stroke();
      } 
      else if (type === 'ice') {
        const grad = ctx.createLinearGradient(b.x - b.radius, b.y - b.radius, b.x + b.radius, b.y + b.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, b.color);
        grad.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x - b.radius*0.5, b.y - b.radius*0.5);
        ctx.lineTo(b.x + b.radius*0.3, b.y + b.radius*0.4);
        ctx.moveTo(b.x + b.radius*0.4, b.y - b.radius*0.6);
        ctx.lineTo(b.x - b.radius*0.3, b.y + b.radius*0.5);
        ctx.stroke();
      } 
      else {
        ctx.fillStyle = b.color;
        ctx.fill();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.2, b.radius * 0.25, 0, Math.PI * 2);
        ctx.arc(b.x + b.radius * 0.4, b.y + b.radius * 0.3, b.radius * 0.18, 0, Math.PI * 2);
        ctx.arc(b.x - b.radius * 0.1, b.y + b.radius * 0.5, b.radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }

      if (type !== 'blackhole') {
        const shadowGrad = ctx.createRadialGradient(
          b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.05,
          b.x, b.y, b.radius
        );
        shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        shadowGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.55)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = shadowGrad;
        ctx.fill();
      }

      ctx.restore();

      if (type === 'gas') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.PI / 8);
        ctx.beginPath();
        ctx.ellipse(0, 0, b.radius * 1.8, b.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 244, 245, 0.35)';
        ctx.lineWidth = b.radius * 0.22;
        ctx.stroke();
        ctx.restore();
      }

      if (type === 'blackhole') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(-Math.PI / 10);
        
        const accGrad = ctx.createRadialGradient(0, 0, b.radius * 0.8, 0, 0, b.radius * 2.8);
        accGrad.addColorStop(0, 'rgba(251, 146, 60, 0.85)');
        accGrad.addColorStop(0.4, 'rgba(236, 72, 153, 0.4)');
        accGrad.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.ellipse(0, 0, b.radius * 3.0, b.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = accGrad;
        ctx.fill();
        ctx.restore();
      }

      if (type === 'star') {
        ctx.save();
        const activeSeconds = Date.now() / 1000;
        const pulse = Math.sin(activeSeconds * 6) * 1.5;
        const outerGlow = b.radius * (1.5 + pulse * 0.08);

        const glowGrad = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, outerGlow);
        glowGrad.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
        glowGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.2)');
        glowGrad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(b.x, b.y, outerGlow, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
        ctx.restore();
      }
    };

    const render = (timestamp) => {
      // --- CALCULO PRECISO DO FPS ---
      frameCountRef.current++;
      if (timestamp - lastFpsUpdateRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = timestamp;
      }
      lastTimeRef.current = timestamp;

      updatePhysics();

      // Limpar Arena do Espaço
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

      ctx.save();
      const centerX = dimensionsRef.current.width / 2;
      const centerY = dimensionsRef.current.height / 2;
      ctx.translate(centerX + panRef.current.x, centerY + panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      // Renderização do Grid
      if (showGridRef.current) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 0.5 / zoomRef.current;
        const gridSize = 100;
        const limitX = Math.ceil(dimensionsRef.current.width / zoomRef.current / gridSize) * 2;
        const limitY = Math.ceil(dimensionsRef.current.height / zoomRef.current / gridSize) * 2;

        for (let x = -limitX * gridSize; x <= limitX * gridSize; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, -limitY * gridSize);
          ctx.lineTo(x, limitY * gridSize);
          ctx.stroke();
        }
        for (let y = -limitY * gridSize; y <= limitY * gridSize; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(-limitX * gridSize, y);
          ctx.lineTo(limitX * gridSize, y);
          ctx.stroke();
        }

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1 / zoomRef.current;
        ctx.beginPath();
        ctx.moveTo(-3000, 0); ctx.lineTo(3000, 0);
        ctx.moveTo(0, -3000); ctx.lineTo(0, 3000);
        ctx.stroke();
      }

      // Desenhar Trilhas Elípticas (Rastros)
      if (showPathsRef.current) {
        bodiesRef.current.forEach((b) => {
          if (b.trail.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(b.trail[0].x, b.trail[0].y);
          for (let i = 1; i < b.trail.length; i++) {
            ctx.lineTo(b.trail[i].x, b.trail[i].y);
          }
          ctx.strokeStyle = b.color;
          ctx.lineWidth = Math.max(0.8, Math.min(2.5, b.radius / 7)) / zoomRef.current;
          ctx.globalAlpha = 0.4;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        });
      }

      // Desenhar Corpos Celestes
      bodiesRef.current.forEach((b) => {
        drawProceduralTexture(ctx, b);

        if (b.id === selectedBodyIdRef.current) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius + 5 / zoomRef.current, 0, Math.PI * 2);
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 2.5 / zoomRef.current;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius + 10 / zoomRef.current, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
          ctx.lineWidth = 1 / zoomRef.current;
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (showVectorsRef.current) {
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + b.vx * 15, b.y + b.vy * 15);
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.5 / zoomRef.current;
          ctx.stroke();

          const angle = Math.atan2(b.vy, b.vx);
          ctx.beginPath();
          ctx.moveTo(b.x + b.vx * 15, b.y + b.vy * 15);
          ctx.lineTo(
            b.x + b.vx * 15 - 6 * Math.cos(angle - Math.PI/6),
            b.y + b.vy * 15 - 6 * Math.sin(angle - Math.PI/6)
          );
          ctx.lineTo(
            b.x + b.vx * 15 - 6 * Math.cos(angle + Math.PI/6),
            b.y + b.vy * 15 - 6 * Math.sin(angle + Math.PI/6)
          );
          ctx.fillStyle = '#22c55e';
          ctx.fill();
        }

        ctx.fillStyle = '#94a3b8';
        ctx.font = `bold ${Math.max(9, 11 / zoomRef.current)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x, b.y - b.radius - 8);
      });

      // Linhas dinâmicas durante lançamento por empurrão
      if (isDrawingVector.current) {
        const sX = (vectorStart.current.x - centerX - panRef.current.x) / zoomRef.current;
        const sY = (vectorStart.current.y - centerY - panRef.current.y) / zoomRef.current;
        const eX = (vectorEnd.current.x - centerX - panRef.current.x) / zoomRef.current;
        const eY = (vectorEnd.current.y - centerY - panRef.current.y) / zoomRef.current;

        ctx.beginPath();
        ctx.moveTo(sX, sY);
        ctx.lineTo(eX, eY);
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2 / zoomRef.current;
        ctx.stroke();

        const angle = Math.atan2(eY - sY, eX - sX);
        ctx.beginPath();
        ctx.moveTo(eX, eY);
        ctx.lineTo(
          eX - 8 * Math.cos(angle - Math.PI/6),
          eY - 8 * Math.sin(angle - Math.PI/6)
        );
        ctx.lineTo(
          eX - 8 * Math.cos(angle + Math.PI/6),
          eY - 8 * Math.sin(angle + Math.PI/6)
        );
        ctx.fillStyle = '#818cf8';
        ctx.fill();

        // Renderizar trajetória preditiva tracejada
        if (predictionPointsRef.current.length > 1) {
          ctx.beginPath();
          ctx.moveTo(predictionPointsRef.current[0].x, predictionPointsRef.current[0].y);
          for (let i = 1; i < predictionPointsRef.current.length; i++) {
            ctx.lineTo(predictionPointsRef.current[i].x, predictionPointsRef.current[i].y);
          }
          ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
          ctx.lineWidth = 1.5 / zoomRef.current;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(sX, sY, getTargetRadius(), 0, Math.PI * 2);
        ctx.fillStyle = getTargetColor();
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Auxiliares de criação
  const getTargetRadius = () => {
    if (selectedBodyType === 'custom') return customRadius;
    if (selectedBodyType === 'star') return 24;
    if (selectedBodyType === 'planet') return 10;
    return 5;
  };

  const getTargetMass = () => {
    if (selectedBodyType === 'custom') return customMass;
    if (selectedBodyType === 'star') return 14000;
    if (selectedBodyType === 'planet') return 150;
    return 15;
  };

  const getTargetColor = () => {
    if (selectedBodyType === 'custom') return customColor;
    if (selectedBodyType === 'star') return '#f59e0b';
    if (selectedBodyType === 'planet') return '#0ea5e9';
    return '#a1a1aa';
  };

  const getTargetName = () => {
    if (selectedBodyType === 'custom') return customName || "Planeta X";
    const index = bodiesRef.current.length + 1;
    if (selectedBodyType === 'star') return `Estrela-${index}`;
    if (selectedBodyType === 'planet') return `Planeta-${index}`;
    return `Satélite-${index}`;
  };

  const getTargetStyle = () => {
    if (selectedBodyType === 'custom') return customStyle;
    if (selectedBodyType === 'star') return 'star';
    if (selectedBodyType === 'planet') return 'gas';
    return 'rocky';
  };

  // --- INTERAÇÕES DO MOUSE ---
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const universeX = (mouseX - centerX - panRef.current.x) / zoom;
    const universeY = (mouseY - centerY - panRef.current.y) / zoom;

    if (e.button === 0) {
      // Verificar clique no corpo para abrir inspetor
      const bodies = bodiesRef.current;
      let clickedBody = null;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const dist = Math.sqrt((b.x - universeX) ** 2 + (b.y - universeY) ** 2);
        if (dist <= b.radius + 6) {
          clickedBody = b;
          break;
        }
      }

      if (clickedBody) {
        sounds.playSelect();
        setSelectedBodyId(clickedBody.id);
      } else {
        // Lançamento livre
        isDrawingVector.current = true;
        vectorStart.current = { x: mouseX, y: mouseY };
        vectorEnd.current = { x: mouseX, y: mouseY };
        predictionPointsRef.current = [];
      }
    } else if (e.button === 2 || e.button === 1) {
      isDraggingCamera.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDrawingVector.current) {
      vectorEnd.current = { x: mouseX, y: mouseY };

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const sX = (vectorStart.current.x - centerX - panRef.current.x) / zoom;
      const sY = (vectorStart.current.y - centerY - panRef.current.y) / zoom;
      const eX = (vectorEnd.current.x - centerX - panRef.current.x) / zoom;
      const eY = (vectorEnd.current.y - centerY - panRef.current.y) / zoom;

      // Direção do empuxo à frente
      const sensitivity = 0.08;
      const vx = (eX - sX) * sensitivity;
      const vy = (eY - sY) * sensitivity;

      calculatePrediction(sX, sY, vx, vy, getTargetMass());
    } else if (isDraggingCamera.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      panRef.current = {
        x: panRef.current.x + dx,
        y: panRef.current.y + dy
      };
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (e) => {
    if (e.button === 0 && isDrawingVector.current) {
      isDrawingVector.current = false;

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;

      const sX = (vectorStart.current.x - centerX - panRef.current.x) / zoom;
      const sY = (vectorStart.current.y - centerY - panRef.current.y) / zoom;
      const eX = (vectorEnd.current.x - centerX - panRef.current.x) / zoom;
      const eY = (vectorEnd.current.y - centerY - panRef.current.y) / zoom;

      const sensitivity = 0.08;
      const vx = (eX - sX) * sensitivity;
      const vy = (eY - sY) * sensitivity;

      const mass = getTargetMass();
      const radius = getTargetRadius();
      const color = getTargetColor();
      const name = getTargetName();
      const style = getTargetStyle();

      sounds.playLaunch(mass);

      const newBody = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        name,
        x: sX,
        y: sY,
        vx,
        vy,
        mass,
        radius,
        color,
        style,
        brightness: selectedBodyType === 'custom' ? customBrightness : 100,
        saturation: selectedBodyType === 'custom' ? customSaturation : 100,
        fixed: false,
        trail: []
      };

      bodiesRef.current.push(newBody);
      predictionPointsRef.current = [];
    } else if (isDraggingCamera.current) {
      isDraggingCamera.current = false;
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    if (e.deltaY < 0) {
      setZoom(z => Math.min(6.0, z * scaleFactor));
    } else {
      setZoom(z => Math.max(0.12, z / scaleFactor));
    }
  };


  // Engenharia orbital
  const circularizeSelectedOrbit = () => {
    const bodies = bodiesRef.current;
    const S = bodies.find(b => b.id === selectedBodyId);
    if (!S || S.fixed) return;

    let primary = null;
    let maxMass = -1;
    bodies.forEach(b => {
      if (b.id !== S.id && b.mass > maxMass) {
        maxMass = b.mass;
        primary = b;
      }
    });

    if (!primary) return;

    sounds.playSelect();

    const rx = S.x - primary.x;
    const ry = S.y - primary.y;
    const r = Math.sqrt(rx * rx + ry * ry);

    if (r === 0) return;

    const vcirc = Math.sqrt((gravitationalConstant * primary.mass) / r);

    let px = -ry / r;
    let py = rx / r;

    const dotProduct = px * S.vx + py * S.vy;
    if (dotProduct < 0) {
      px = -px;
      py = -py;
    }

    S.vx = primary.vx + px * vcirc;
    S.vy = primary.vy + py * vcirc;
    S.trail = [];
  };

  const scaleSelectedOrbit = (factor) => {
    const bodies = bodiesRef.current;
    const S = bodies.find(b => b.id === selectedBodyId);
    if (!S || S.fixed) return;

    let primary = null;
    let maxMass = -1;
    bodies.forEach(b => {
      if (b.id !== S.id && b.mass > maxMass) {
        maxMass = b.mass;
        primary = b;
      }
    });

    if (!primary) return;

    sounds.playSelect();

    const rx = S.x - primary.x;
    const ry = S.y - primary.y;
    const r = Math.sqrt(rx * rx + ry * ry);

    if (r === 0) return;

    S.x = primary.x + rx * factor;
    S.y = primary.y + ry * factor;

    const relativeVx = S.vx - primary.vx;
    const relativeVy = S.vy - primary.vy;
    
    S.vx = primary.vx + relativeVx / Math.sqrt(factor);
    S.vy = primary.vy + relativeVy / Math.sqrt(factor);

    S.trail = [];
  };

  const updateSelectedBody = (field, value) => {
    bodiesRef.current = bodiesRef.current.map(b => {
      if (b.id === selectedBodyId) {
        const updated = { ...b, [field]: value };
        if (field === 'mass') {
          updated.radius = Math.max(3, Math.round(Math.pow(value, 1/3) * 2));
        }
        return updated;
      }
      return b;
    });
  };

  const clearCanvas = () => {
    sounds.playSelect();
    bodiesRef.current = [];
    setSelectedBodyId(null);
  };

  const getSelectedBody = () => {
    return bodiesRef.current.find(b => b.id === selectedBodyId);
  };

  const targetBody = getSelectedBody();

  return (
    <div className="flex flex-row w-full h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden select-none">
      
      {/* TELA DE BOAS-VINDAS */}
      {showWelcome && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-8 space-y-6 text-center">
              <div className="mx-auto w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                <Compass className="w-10 h-10 animate-spin" style={{ animationDuration: '10s' }} />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-wider text-white">ORBIT LAB v2.0</h1>
                <p className="text-xs text-indigo-400 font-mono tracking-widest uppercase">Laboratório de Astrofísica Avançado</p>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                Olá, bem-vindo ao simulador gravitacional! Agora com suporte a **anéis cósmicos**, **texturas dinâmicas procedurais**, engenharia de arredondamento de órbitas e um vetor de lançamento inteligente.
              </p>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-left space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Presets de início rápido:
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { loadPreset('solar_system'); setShowWelcome(false); }}
                    className="p-3 bg-slate-900/60 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-xs font-semibold transition-all text-slate-200"
                  >
                    🪐 Sistema Solar
                  </button>
                  <button 
                    onClick={() => { loadPreset('black_hole'); setShowWelcome(false); }}
                    className="p-3 bg-slate-900/60 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-xs font-semibold transition-all text-slate-200"
                  >
                    🕳️ Buraco Negro
                  </button>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={() => { sounds.playSelect(); setShowWelcome(false); }}
                  className="w-full sm:w-auto px-8 py-3 bg-indigo-500 hover:bg-indigo-600 font-semibold text-sm rounded-xl text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all hover:scale-105"
                >
                  Entrar no Laboratório
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL LATERAL ESQUERDO: CONFIGURAÇÃO GLOBAL E CRIADOR */}
      <div className={`bg-slate-900 border-r border-slate-800 flex flex-col z-10 shrink-0 h-full transition-all duration-300 ${
        leftPanelOpen ? 'w-[350px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-r-0'
      }`}>
        
        {/* Cabecalho */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-amber-500/15 rounded-lg text-amber-400 border border-amber-500/25">
              <Sun className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wider text-white">ORBIT-LAB 2</h1>
              <p className="text-[10px] text-amber-400 font-mono tracking-widest uppercase">Global Control</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => { sounds.playSelect(); setShowWelcome(true); }} 
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors border border-slate-700/80"
              title="Ajuda / Boas-Vindas"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button 
              onClick={toggleMute} 
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700/80 text-slate-300"
              title={isMuted ? "Ativar som" : "Desativar som"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Abas Esquerda */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 text-xs font-semibold">
          <button 
            onClick={() => { sounds.playSelect(); setActiveTab('presets'); }}
            className={`flex-1 py-3 text-center transition-all ${activeTab === 'presets' ? 'border-b-2 border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Mundos Prontos
          </button>
          <button 
            onClick={() => { sounds.playSelect(); setActiveTab('custom'); }}
            className={`flex-1 py-3 text-center transition-all ${activeTab === 'custom' ? 'border-b-2 border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Criar Astros
          </button>
          <button 
            onClick={() => { sounds.playSelect(); setActiveTab('stats'); }}
            className={`flex-1 py-3 text-center transition-all ${activeTab === 'stats' ? 'border-b-2 border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Estatísticas
          </button>
        </div>

        {/* Conteudo Abas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* ABA: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Cenários Cósmicos
              </div>
              <div className="space-y-2">
                {Object.keys(presets).map((key) => (
                  <button
                    key={key}
                    onClick={() => loadPreset(key)}
                    className="w-full text-left p-3.5 bg-slate-800/40 hover:bg-indigo-500/5 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all flex justify-between items-center group"
                  >
                    <div className="space-y-1 pr-2">
                      <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {presets[key].name}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-normal">
                        {presets[key].desc}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ABA: CRIADOR DE CORPOS */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                <p className="text-[11px] text-indigo-400 font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Vetor de Empuxo Ativo:
                </p>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Clique e arraste em uma região vazia do espaço para frente. A linha projeta a **direção de empuxo** e simula o rastro orbital antes do lançamento!
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Astro</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'planet', label: 'Planeta', color: '#0ea5e9' },
                    { id: 'star', label: 'Estrela', color: '#f59e0b' },
                    { id: 'moon', label: 'Satélite', color: '#a1a1aa' },
                    { id: 'custom', label: 'Custom', color: '#818cf8' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { sounds.playSelect(); setSelectedBodyType(t.id); }}
                      className={`py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${
                        selectedBodyType === t.id 
                          ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.15)]' 
                          : 'bg-slate-800/35 border-slate-800 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: t.color }}></span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedBodyType === 'custom' && (
                <div className="p-3.5 bg-slate-850/40 border border-slate-850 rounded-xl space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Designação do Astro</label>
                    <input 
                      type="text" 
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors text-slate-100"
                      placeholder="Nome do planeta"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Estilo Visual</label>
                      <select
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-100"
                      >
                        <option value="rocky">🪨 Rochoso</option>
                        <option value="gas">🪐 Gasoso</option>
                        <option value="ice">❄️ Gelo</option>
                        <option value="lava">🔥 Lava</option>
                        <option value="star">☀️ Estrela</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Massa (UM)</label>
                      <input 
                        type="number" 
                        value={customMass}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 0);
                          setCustomMass(val);
                          setCustomRadius(Math.max(3, Math.round(Math.pow(val, 1/3) * 2)));
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-xs text-center focus:outline-none focus:border-indigo-500 text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Saturação Visual</span>
                        <span className="font-mono text-indigo-400">{customSaturation}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="200" value={customSaturation}
                        onChange={(e) => setCustomSaturation(parseInt(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Brilho Albedo</span>
                        <span className="font-mono text-indigo-400">{customBrightness}%</span>
                      </div>
                      <input 
                        type="range" min="30" max="200" value={customBrightness}
                        onChange={(e) => setCustomBrightness(parseInt(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Cromatismo Celestial</label>
                    <div className="flex justify-between gap-1">
                      {['#38bdf8', '#f43f5e', '#a855f7', '#10b981', '#fb923c', '#ffffff', '#eab308'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setCustomColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            customColor === color ? 'border-white scale-110 shadow-lg' : 'border-slate-800'
                          }`}
                          style={{ backgroundColor: color }}
                        ></button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA: TELEMETRIA */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-pulse" /> Telemetria Cósmica
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <div className="text-[9px] text-slate-400">CORPOS ATIVOS</div>
                  <div className="text-md font-bold text-slate-100">{stats.bodyCount}</div>
                </div>
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <div className="text-[9px] text-slate-400">MASSA SISTÊMICA</div>
                  <div className="text-md font-bold text-indigo-400">{stats.totalMass} UM</div>
                </div>
                
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg col-span-2 space-y-1">
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>ENERGIA CINÉTICA (Ke)</span>
                    <span className="text-emerald-400">+{stats.kineticEnergy} J</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(5, (stats.kineticEnergy / (stats.kineticEnergy + Math.abs(stats.potentialEnergy) || 1)) * 100))}%` }}
                    ></div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg col-span-2 space-y-1">
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>POTENCIAL GRAVITACIONAL (Pe)</span>
                    <span className="text-red-400">{stats.potentialEnergy} J</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                    <div 
                      className="bg-red-500 h-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(5, (Math.abs(stats.potentialEnergy) / (stats.kineticEnergy + Math.abs(stats.potentialEnergy) || 1)) * 100))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AJUSTES DE ESPAÇO-TEMPO */}
          <div className="p-4 bg-slate-850/30 border border-slate-850 rounded-2xl space-y-3.5">
            <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Engenharia Dimensional
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Constante Gravitacional ($G$)</span>
                <span className="font-mono text-indigo-400">{gravitationalConstant}</span>
              </div>
              <input 
                type="range" min="0.01" max="1.50" step="0.01" value={gravitationalConstant}
                onChange={(e) => setGravitationalConstant(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-850 h-1 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Dilação Temporal ($\Delta t$)</span>
                <span className="font-mono text-indigo-400">{timeStep === 0 ? "PAUSADO" : `${timeStep}x`}</span>
              </div>
              <input 
                type="range" min="0" max="3" step="0.1" value={timeStep}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTimeStep(val);
                  setIsPlaying(val > 0);
                }}
                className="w-full accent-indigo-500 bg-slate-850 h-1 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Reticulado de Rastro</span>
                <span className="font-mono text-indigo-400">{trailLength} pts</span>
              </div>
              <input 
                type="range" min="10" max="400" step="10" value={trailLength}
                onChange={(e) => setTrailLength(parseInt(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-850 h-1 rounded"
              />
            </div>
          </div>
        </div>

        {/* CONTROLES VISUAIS RAPIDOS */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex justify-around text-[10px] text-slate-400 shrink-0">
          <button 
            onClick={() => { sounds.playSelect(); setShowGrid(!showGrid); }}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg border transition-all ${showGrid ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' : 'border-transparent hover:text-slate-200'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Grade
          </button>
          <button 
            onClick={() => { sounds.playSelect(); setShowVectors(!showVectors); }}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg border transition-all ${showVectors ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' : 'border-transparent hover:text-slate-200'}`}
          >
            <Zap className="w-3.5 h-3.5" /> Vetores
          </button>
          <button 
            onClick={() => { sounds.playSelect(); setShowPaths(!showPaths); }}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg border transition-all ${showPaths ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' : 'border-transparent hover:text-slate-200'}`}
          >
            <Sliders className="w-3.5 h-3.5" /> Rastros
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL: SIMULAÇÃO CÓSMICA */}
      <div id="canvas-container" className="flex-1 relative bg-slate-950 overflow-hidden h-full">
        
        {/* Canvas da Física em 60 FPS */}
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 block w-full h-full cursor-crosshair select-none touch-none"
        />

        {/* HUD Superior */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-center gap-3 pointer-events-none z-10">
          
          {/* Menu de Reprodutor */}
          <div className="flex items-center bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-xl pointer-events-auto space-x-2">
            
            {/* Botão de Toggle Lateral do Painel de Controle */}
            <button
              onClick={() => { sounds.playSelect(); setLeftPanelOpen(!leftPanelOpen); }}
              className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                leftPanelOpen 
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700 hover:text-indigo-300' 
                  : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
              }`}
              title={leftPanelOpen ? "Recolher Painel de Controle" : "Expandir Painel de Controle"}
            >
              <Sliders className={`w-3.5 h-3.5 transition-transform duration-300 ${leftPanelOpen ? 'rotate-90' : 'rotate-0'}`} />
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-0.5"></div>

            <button
              onClick={() => {
                sounds.playSelect();
                setIsPlaying(!isPlaying);
                if (!isPlaying && timeStep === 0) setTimeStep(1);
              }}
              className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                isPlaying 
                  ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              onClick={() => {
                sounds.playSelect();
                loadPreset('solar_system');
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg text-slate-300 hover:text-slate-100 transition-all"
              title="Reiniciar Simulação"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-1"></div>

            <button
              onClick={clearCanvas}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar Espaço</span>
            </button>
          </div>

          {/* Medidor Cósmico (Fidelidade de Render e FPS) */}
          <div className="flex items-center bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 shadow-xl pointer-events-auto space-x-3 text-[10px] font-mono">
            <div className="flex items-center space-x-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-emerald-400 font-bold">{fps} FPS</span>
            </div>
            
            <div className="h-4 w-[1px] bg-slate-850"></div>

            <div className="flex items-center space-x-2 text-slate-300">
              <button 
                onClick={() => { sounds.playSelect(); setZoom(z => Math.max(0.12, z / 1.1)); }}
                className="p-0.5 hover:bg-slate-800 rounded font-bold text-[11px] w-5 h-5 flex items-center justify-center border border-slate-800"
              >
                -
              </button>
              <span className="min-w-10 text-center font-semibold text-indigo-400">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={() => { sounds.playSelect(); setZoom(z => Math.min(6.0, z * 1.1)); }}
                className="p-0.5 hover:bg-slate-800 rounded font-bold text-[11px] w-5 h-5 flex items-center justify-center border border-slate-800"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Instuções Rápidas Flutuantes */}
        <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400 font-mono shadow-xl max-w-xs space-y-1 z-10 pointer-events-none select-none">
          <p className="text-indigo-400 font-bold mb-1 text-[11px]">Navegação:</p>
          <p>• <strong className="text-slate-300">Esquerdo:</strong> Arraste e empurre para frente para lançar</p>
          <p>• <strong className="text-slate-300">Clique no Astro:</strong> Abre Astro-Inspetor de edição</p>
          <p>• <strong className="text-slate-300">Botão Direito:</strong> Arraste para mover câmera (pan)</p>
          <p>• <strong className="text-slate-300">Scroll:</strong> Altera o zoom do campo orbital</p>
        </div>

        {/* Cartaz de Espaço Limpo */}
        {stats.bodyCount === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none">
            <div className="max-w-md bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-2xl shadow-2xl space-y-3">
              <Globe className="w-10 h-10 text-indigo-400 mx-auto animate-pulse" />
              <h2 className="text-md font-bold text-slate-200">Espaço Gravitacional Vazio</h2>
              <p className="text-xs text-slate-400 leading-normal">
                Lance astros clicando e arrastando com o botão esquerdo para ver as órbitas em tempo real ou carregue um universo predefinido no menu lateral esquerdo.
              </p>
            </div>
          </div>
        )}
      </div>


      {/* PAINEL LATERAL DIREITO: ASTRO-INSPETOR DINÂMICO (EDITAR PLANETA SELECIONADO) */}
      <div className={`bg-slate-900 border-l border-slate-800 flex flex-col z-10 shrink-0 h-full transition-all duration-300 ${
        targetBody ? 'w-[320px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
      }`}>
        {targetBody && (
          <div className="flex flex-col h-full">
            
            {/* Cabeçalho do Inspetor */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-indigo-950/20">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: targetBody.color }}></span>
                <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest">Astro-Inspetor</span>
              </div>
              <button 
                onClick={() => setSelectedBodyId(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title="Fechar Painel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form de Edição */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
              
              {/* Rótulo e Estilo */}
              <div className="space-y-3 p-3 bg-slate-950/50 border border-slate-850 rounded-xl">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Identificação</label>
                  <input 
                    type="text"
                    value={targetBody.name}
                    onChange={(e) => updateSelectedBody('name', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2.5 font-bold focus:outline-none focus:border-indigo-500 text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Textura Geológica</label>
                  <select
                    value={targetBody.style || 'rocky'}
                    onChange={(e) => updateSelectedBody('style', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-1.5 focus:outline-none focus:border-indigo-500 text-slate-100"
                  >
                    <option value="rocky">🪨 Rochoso (Crateras)</option>
                    <option value="gas">🪐 Gasoso (Atm e Anéis)</option>
                    <option value="ice">❄️ Gelado (Cristais)</option>
                    <option value="lava">🔥 Magmático (Lava Ativa)</option>
                    <option value="star">☀️ Estrela (Solar Flare)</option>
                    <option value="blackhole">🕳️ Singularidade (Buraco Negro)</option>
                  </select>
                </div>
              </div>

              {/* Parâmetros Físicos */}
              <div className="space-y-3 p-3 bg-slate-950/50 border border-slate-850 rounded-xl font-mono">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Massa & Gravidade</span>
                  <span className="text-indigo-400">{Math.round(targetBody.mass)} UM</span>
                </div>
                <input 
                  type="range" min="1" max="30000" step="10" value={targetBody.mass}
                  onChange={(e) => updateSelectedBody('mass', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Raio Físico</span>
                  <span className="text-indigo-400">{Math.round(targetBody.radius)} px</span>
                </div>
                <input 
                  type="range" min="3" max="80" value={targetBody.radius}
                  onChange={(e) => updateSelectedBody('radius', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />

                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Fixar no Espaço (Estático):</span>
                  <input 
                    type="checkbox"
                    checked={!!targetBody.fixed}
                    onChange={(e) => updateSelectedBody('fixed', e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-500 bg-slate-900 border-slate-800 cursor-pointer text-slate-100"
                  />
                </div>
              </div>

              {/* Filtros de Sat/Brilho e Cor */}
              <div className="space-y-3 p-3 bg-slate-950/50 border border-slate-850 rounded-xl">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                    <span>Saturação Visual</span>
                    <span className="font-mono text-indigo-400">{targetBody.saturation !== undefined ? targetBody.saturation : 100}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="200" value={targetBody.saturation !== undefined ? targetBody.saturation : 100}
                    onChange={(e) => updateSelectedBody('saturation', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                    <span>Brilho Albedo</span>
                    <span className="font-mono text-indigo-400">{targetBody.brightness !== undefined ? targetBody.brightness : 100}%</span>
                  </div>
                  <input 
                    type="range" min="30" max="200" value={targetBody.brightness !== undefined ? targetBody.brightness : 100}
                    onChange={(e) => updateSelectedBody('brightness', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cromaticidade</label>
                  <div className="flex gap-1.5 mt-1">
                    {['#38bdf8', '#f43f5e', '#a855f7', '#10b981', '#fb923c', '#ffffff', '#eab308'].map((c) => (
                      <button
                        key={c}
                        onClick={() => updateSelectedBody('color', c)}
                        className={`w-5.5 h-5.5 rounded-full border-2 transition-all ${
                          targetBody.color === c ? 'border-white scale-110' : 'border-slate-800'
                        }`}
                        style={{ backgroundColor: c }}
                      ></button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ENGENHARIA ORBITAL DINÂMICA (ARREDONDAR / ESCALAR) */}
              <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl space-y-3.5">
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} /> Engenharia Orbital
                </div>

                <button
                  onClick={circularizeSelectedOrbit}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 rounded-lg text-white font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                  title="Ajusta o vetor de velocidade relativo à estrela para manter uma órbita perfeitamente circular"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Arredondar Órbita teórica
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => scaleSelectedOrbit(1.15)}
                    className="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-750 hover:border-slate-600 transition-colors font-bold"
                    title="Aumenta o diâmetro da órbita preservando a relação de velocidade estável"
                  >
                    ➕ Expandir Órbita
                  </button>
                  <button
                    onClick={() => scaleSelectedOrbit(0.85)}
                    className="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-750 hover:border-slate-600 transition-colors font-bold"
                    title="Encolhe o diâmetro da órbita mantendo a estabilidade orbital"
                  >
                    ➖ Encolher Órbita
                  </button>
                </div>
              </div>

              {/* Ação Destrutiva */}
              <button
                onClick={() => {
                  sounds.playSelect();
                  bodiesRef.current = bodiesRef.current.filter(b => b.id !== selectedBodyId);
                  setSelectedBodyId(null);
                }}
                className="w-full py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-500/25 hover:border-red-500/45 text-red-300 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Destruir Astro Selecionado
              </button>

            </div>
          </div>
        )}
      </div>

    </div>
  );
}
