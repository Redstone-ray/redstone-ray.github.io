/*
  Site content. Edit this file to change text, projects, CV entries or links.
  Everything on the page is rendered from here, so no HTML edits are needed
  for routine updates.

  Project fields
    slug      url-safe id, used in links like  #/work/<slug>
    caption   the one sentence shown on the grid tile
    cover     what the tile shows: { type: 'image' | 'video', src, poster?, still?, lead?, fit?, tone?, bg?, scrim?, feather?, aspect }
                still: for an animated .svg cover, a frozen copy shown under reduced motion
                       or when the visitor pauses motion
                lead: false keeps the cover from being repeated at the top of the project page
                fit:  'cover' (default) fills the tile, 'contain' centres a smaller image on bg
                tone: 'dark' = light caption text, 'light' = dark caption text
                scrim: 'strong' darkens the bottom of a busy or bright cover so its caption stays readable
                feather: true fades the edges of a render whose background isn't quite flat
                aspect: tile width / height on desktop
    gallery   media shown inside the project page, in order
                { type: 'image', src, alt, caption?, wide?, aspect?, edge? }   (aspect: only for an .svg without width/height;
                                                                  edge: a hairline round a white-ground image)
                  srcNarrow, aspectNarrow: a tall twin of a wide .svg, shown on phones
                { type: 'video', src, poster, alt, caption? }
                { type: 'compare', before, after, labels: [left, right], alt, caption? }
    hidden    true hides a project without deleting it

  Media can be a path under assets/media/ or a full https:// URL (used for
  Musashi's own Suspension Sense images, see README).

  The Harvard (Aizenberg Lab) and Cornell work is unpublished, so those
  projects show illustrations and simulations made for this site, never lab
  photos, footage or data.
*/

window.SITE = {
  name: 'Richard Ding',
  shortRole: 'Mechatronics engineer (almost)',
  email: 'richard.ding@uwaterloo.ca',
  location: 'Cambridge, MA · Waterloo, ON',
  links: [
    { label: 'GitHub', url: 'https://github.com/Redstone-ray' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/richard-ding-40b59017a/' },
    { label: 'Aizenberg Lab', url: 'https://aizenberglab.seas.harvard.edu/people/richard-ding' }
  ],

  // Hero. Words wrapped in <em> are set in italic serif in the accent colour.
  hero: {
    eyebrow: 'Mechatronics Engineering, University of Waterloo · Research Fellow, Harvard SEAS',
    headline: 'I build instruments, controllers and machines that move <em>liquid</em>, <em>light</em> and the occasional <em>rocket</em>.',
    hint: 'Press and hold anywhere to grow a fluid flower. It’s what I study.'
  },

  about: [
    'I build hardware that moves fluids, light and rockets, and the control systems that keep it all in line.',
    'I study Mechatronics Engineering at the University of Waterloo, and right now I’m a Research Fellow in <a href="https://aizenberglab.seas.harvard.edu/" target="_blank" rel="noopener">Joanna Aizenberg’s lab</a> at Harvard SEAS, where I make liquid-filled windows that tune sunlight and heat, and grow fluid flowers between sheets of glass.',
    'Before that I rebuilt a gravity-drop plunger at Cornell that freezes protein crystals within 10 ms of mixing, prototyped a car ball joint at Musashi that senses its own wear, and led the controls team behind the canards and airbrakes on Waterloo Rocketry’s liquid-fuelled rockets.',
    'When a lab is missing a tool, I usually end up building it.'
  ],

  // Short "fuel gauge" facts on the about section.
  facts: [
    { k: 'Running on', v: 'black iced coffee' },
    { k: 'Favourite food', v: 'poutine' },
    { k: 'Longest ride', v: '1,000+ km around Taiwan' }
  ],

  // Degree progress bar ("Mechatronics engineer (almost)").
  degree: { label: 'Mechatronics engineer', start: '2022-09-01', end: '2027-04-30' },

  cv: {
    education: [
      { when: '2022 – 2027', what: 'BASc, Mechatronics Engineering (Co-op)', where: 'University of Waterloo', note: 'Dean’s List (2026)' },
      { when: '2019 – 2022', what: 'Ontario Secondary School Diploma', where: 'London Central Secondary School', note: 'Governor General’s Academic Medal' }
    ],
    experience: [
      { when: 'Apr 2026 – now', what: 'Research Fellow', where: 'Aizenberg Lab, Harvard SEAS', note: 'Liquafilm hardware co-lead (liquid smart windows), viscous-fingering experiments. Mentored a summer undergraduate researcher.' },
      { when: 'Jan – Apr 2026', what: 'Research Assistant', where: 'Waterloo Microfluidics Lab (Prof. Carolyn Ren)', note: 'Soft compression sleeve for lymphedema: flexible sensors and closed-loop pressure control.' },
      { when: 'Sep – Dec 2025', what: 'Research Assistant', where: 'Nishida Lab, University of Waterloo', note: 'Physics-based model of low-cost optical aerosol sensors, validated in chamber experiments.' },
      { when: 'May – Aug 2025', what: 'Scientific Instrumentation Development Intern', where: 'Thorne Lab, LASSP, Cornell University', note: 'Gravity-drop mix-and-quench system for time-resolved crystallography.' },
      { when: 'Sep – Dec 2024', what: 'New Product Development Intern', where: 'Musashi Americas', note: 'Smart sensing ball joint: 4-layer automotive PCB, magnetic sensing, CAN firmware, load testing.' },
      { when: 'Apr – Aug 2024', what: 'Research Assistant', where: 'Orthopaedic Mechatronics Lab, University of Waterloo', note: 'Fixtures for 6-axis spinal testers, FEA, 3D-printed vertebrae.' },
      { when: 'Jan – Apr 2024', what: 'Research Assistant', where: 'Engineering IDEAS Clinic, University of Waterloo', note: 'ROS2 TurtleBot navigation modules for robotics and controls courses.' },
      { when: '2023 – now', what: 'Controls Lead', where: 'Waterloo Rocketry', note: 'Airbrakes and canards, flight firmware, 6-DoF sims and a CFD pipeline. Led 30+ students; ran “Controls 101” workshops.' }
    ],
    talks: [
      { when: '2025', what: 'Poster', where: 'Canadian Space Conference' },
      { when: '2024', what: 'Podium talk: “Implementation and Verification of Active Altitude Control System”', where: 'Launch Canada' }
    ],
    // Publications. Set show: true to list them.
    publications: { show: false, items: [] },
    awards: [
      { when: '2026', what: 'Dean’s List, University of Waterloo' },
      { when: '2025', what: 'President’s International Experience Award, University of Waterloo' },
      { when: '2023', what: 'President’s Research Award, University of Waterloo' },
      { when: '2022', what: 'Governor General’s Academic Medal' },
      { when: '2022', what: 'Queen Elizabeth Scholarship, City of London' },
      { when: '2022', what: 'President’s Scholarship of Distinction, University of Waterloo' },
      { when: '', what: '1st place, Mini Sumo Autonomous, Manitoba Robot Games' }
    ],
    service: [
      { when: '2024 – now', what: 'Volunteer, Waterloo Engineering Outreach' },
      { when: '2025', what: 'Judge, VEX Robotics' },
      { when: '2023', what: 'Co-lead, UW REACT “Robot in 3 Days”' }
    ],
    skills: [
      { k: 'Design & simulation', v: 'SolidWorks, Fusion 360, Inventor, CATIA, OpenSCAD, Blender, Ansys (FEA/CFD, PyAnsys), COMSOL, KiCad, Altium' },
      { k: 'Code', v: 'Python (Qt, OpenCV, pandas), C/C++, STM32 + FreeRTOS, ESP32/Arduino, ROS2, MATLAB/Simulink, React/TypeScript' },
      { k: 'Build & measure', v: 'Multi-layer PCBs, CAN bus, pneumatics, machining, 3D printing, laser/waterjet, FTIR, solar simulator, thermal imaging' }
    ]
  }
};

window.PROJECTS = [
  {
    slug: 'blooms',
    title: 'Viscous fingering',
    caption: 'Fluid flowers, grown by pushing one liquid into a thicker one between two sheets of glass',
    year: '2026',
    where: 'Aizenberg Lab, Harvard SEAS',
    role: 'Experiments, imaging rig and analysis software',
    tags: ['fluid mechanics', 'Hele-Shaw cell', 'computer vision', 'Python'],
    body: [
      'When a thin fluid pushes into a thicker one through a narrow gap, the boundary between them goes unstable and branches into fingers: the Saffman–Taylor instability. Pushed in from a single point, the fingers split again and again until the pattern looks like a flower.',
      'I build the imaging rig and fixtures, a segmentation pipeline that measures every pattern frame by frame, a live monitor that streams results from the camera during a run, and the flow protocols that drive the pump.',
      'This work is unpublished, so the pictures here are illustrations and simulations, not lab footage.'
    ],
    cover: { type: 'video', src: 'assets/media/blooms/sim-growth.mp4', poster: 'assets/media/blooms/sim-growth-poster.webp', tone: 'dark', scrim: 'strong', aspect: 1, alt: 'Simulation of a glowing amber fluid bloom growing from a single injection port, its fingers splitting at the tips' },
    gallery: [
      { type: 'video', src: 'assets/media/blooms/sim-growth.mp4', poster: 'assets/media/blooms/sim-growth-poster.webp', alt: 'Simulation of a glowing amber fluid bloom growing from a single injection port, its fingers splitting at the tips as it spreads across a black plate', caption: 'A bloom growing from a single port. Simulated.' },
      { type: 'image', src: 'assets/media/blooms/concept-cell.svg', aspect: 1.6, alt: 'Exploded concept diagram of a Hele-Shaw cell: a thin liquid pumped into the centre between two glass plates branches into splitting fingers as it pushes a thicker liquid aside', caption: 'The setup, exploded: a thin liquid pumped in between two plates of glass pushes a thicker one aside, and its front splits into fingers. Illustration.' },
      { type: 'image', src: 'assets/media/blooms/sim-steps.webp', alt: 'Three moments of one simulated bloom: a near-perfect amber circle, the same front rippling into even scallops, then a flower of fingers splitting at their tips', caption: 'How a bloom forms: a growing circle ripples, then each bulge splits at its tip. An illustration of the instability, not to one scale.', wide: true },
      { type: 'image', src: 'assets/media/blooms/sim-library.webp', alt: 'Twelve simulated fingering patterns on black, ranging from sparse, needle-like branches to dense, compact blooms, some young with only a few fingers and others richly tip-split', caption: 'A dozen blooms from the same simulation with different settings, from sparse and needle-like to dense and petalled. Each is framed on its own, so they aren’t to one scale.', wide: true }
    ]
  },
  {
    slug: 'liquafilm',
    title: 'Liquafilm',
    caption: 'A window screen that fills with liquid to dim the sun, then drains clear again',
    year: '2026',
    where: 'Aizenberg Lab, Harvard SEAS',
    role: 'Hardware co-lead: mechanical design, controls, installation',
    tags: ['smart windows', 'building energy', 'fluidics', 'Arduino / ESP32', 'CAD'],
    body: [
      'Liquafilm is a retrofittable, fluid-filled window screen. Thin cavities fill with a water-based fluid to dim, blur or filter sunlight, drain to go clear, and hold either state with no standby power.',
      'As project co-lead with Raphael Kay, I led the hardware: I designed the second prototype’s glass, frame and brackets, wrote the pump controller with timed, light, temperature and setpoint modes, and took the device from the bench to a full-size window in a real building.',
      'The device isn’t published yet, so the pictures here are illustrations of the idea, not photos.'
    ],
    links: [
      { label: 'Harvard SEAS feature', url: 'https://seas.harvard.edu/news/window-heating-and-cooling' }
    ],
    cover: { type: 'image', src: 'assets/media/liquafilm/concept-cover.svg', still: 'assets/media/liquafilm/concept-cover-still.svg', tone: 'light', bg: '#f4f2ee', lead: false, aspect: 1.12, alt: 'Concept illustration: a window screen that fills with amber liquid to dim the sunlight, then drains clear again' },
    gallery: [
      { type: 'compare', before: 'assets/media/liquafilm/concept-drained.svg', after: 'assets/media/liquafilm/concept-filled.svg', labels: ['drained', 'filled'], alt: 'The same window drained and filled with amber liquid (concept illustration)', caption: 'Drag to fill the window. Illustration.', wide: true },
      { type: 'image', src: 'assets/media/liquafilm/concept-modes.svg', aspect: 2.5, alt: 'Concept diagram of three modes: dim tints the glass amber and weakens the light, blur frosts it and scatters the light, filter lets some colours through and blocks others', caption: 'Three things the liquid can do to sunlight: dim it, blur it, or filter out some colours.', wide: true },
      { type: 'image', src: 'assets/media/liquafilm/concept-layers.svg', aspect: 1.6, alt: 'Exploded concept diagram: the existing window, a thin liquid cavity between two glass sheets, and a frame, with a pump, reservoir and light and temperature sensors', caption: 'How it fits over a window: a thin liquid cavity between two sheets of glass, filled and drained by a pump that listens to light and temperature sensors. Illustration.', wide: true }
    ]
  },
  {
    slug: 'crystallography',
    title: 'Gravity-drop mix-and-quench plunger',
    caption: 'A falling plunger that freezes protein crystals less than 10 milliseconds after mixing',
    year: '2025',
    where: 'Thorne Lab, LASSP, Cornell University',
    role: 'Design lead: mechanical, PCB, gas manifold',
    tags: ['scientific instrumentation', 'PCB design', 'cryogenics', '3D printing'],
    body: [
      'Time-resolved crystallography needs a reaction stopped at an exact moment. This instrument mixes a crystal with a ligand and drops it into liquid nitrogen in under 10 ms.',
      'I led the redesign: I merged the legacy electronics into one motor-control PCB, added dual-sensor drop timing, and designed a gas-exchange manifold that clears cold gas so samples are not pre-cooled on the way down. It is built from 3D-printed and off-the-shelf parts and takes standard sample mounts, so a lab without much money can build one.',
      'The instrument is unpublished, so the pictures here are illustrations, not photos of the device.'
    ],
    cover: { type: 'image', src: 'assets/media/crystallography/concept-cover.svg', still: 'assets/media/crystallography/concept-cover-still.svg', tone: 'light', bg: '#f4f2ee', aspect: 1.45, alt: 'Concept illustration of a gravity-drop plunger: a protein crystal in a sample loop falls through a fine ligand spray and two ring-shaped timing gates into a glass dewar of liquid nitrogen, under 10 ms from mix to quench' },
    gallery: [
      { type: 'image', src: 'assets/media/crystallography/concept-system.svg', aspect: 1.6, alt: 'Concept schematic of the plunger’s electronics: a single motor-control board wired to the drop release, the ligand sprayer, two ring-shaped timing sensors, a gas-exchange manifold that sweeps cold vapour away from the dewar opening, and the liquid-nitrogen dewar', caption: 'One board runs it all: the drop release, the sprayer, two timing sensors, the gas-exchange manifold and the dewar. A schematic, not the real wiring.', wide: true },
      { type: 'image', src: 'assets/media/crystallography/concept-timeline.svg', aspect: 3.46, srcNarrow: 'assets/media/crystallography/concept-timeline-narrow.svg', aspectNarrow: 0.5714, alt: 'A timeline from 0 to 300 milliseconds. The plunger’s mix-to-quench, under 10 ms, is a tiny sliver at the very start. A blink, about 100–150 ms, and pressing a button, about 250 ms, come much later.', caption: 'For scale: mix to quench in under 10 ms, long before you could blink.', wide: true }
    ]
  },
  {
    slug: 'rocketry',
    title: 'Waterloo Rocketry: canards and airbrakes',
    caption: 'Fins that keep a student rocket from spinning, and brakes that stop it at the right height',
    year: '2023 – now',
    where: 'Waterloo Rocketry · Launch Canada',
    role: 'Controls Lead',
    tags: ['controls', 'state estimation', 'STM32 / FreeRTOS', 'Ansys CFD', 'machining'],
    body: [
      'I lead the controls subsystem (30+ students) on Waterloo Rocketry’s liquid-fuelled competition rockets. My first year I worked on almost every part of a solid-motor demo rocket that we built in seven weeks to prove out parachute recovery.',
      'The canards are small fins the flight computer steers to stop the rocket rolling. I worked on the mechanism, the controller and state estimator (LQR with a Kalman filter), the STM32/FreeRTOS flight firmware, 6-DoF MATLAB/Simulink sims and a PyAnsys CFD pipeline for the aerodynamics.',
      'The airbrakes are drag flaps that open mid-flight under closed-loop control so the rocket tops out at a target altitude. I presented them as a podium talk at Launch Canada 2024. You can fly them yourself in the toys section below.'
    ],
    cover: { type: 'video', src: 'assets/media/canards/bench.mp4', poster: 'assets/media/canards/bench-poster.webp', tone: 'dark', aspect: 1.78, alt: 'The canard module tilting on the bench while its fins respond' },
    gallery: [
      { type: 'image', src: 'assets/media/canards/parts.webp', alt: 'Canard fin, bearings, shaft and gear laid out on a table', caption: 'Canard parts, before assembly.', wide: true },
      { type: 'image', src: 'assets/media/canards/mechanism.webp', alt: 'Top view of the machined canard actuation mechanism with a servo', caption: 'The canard actuation mechanism.' },
      { type: 'image', src: 'assets/media/canards/electronics.webp', alt: 'Canard module with wiring and circuit boards', caption: 'Wired up.' },
      { type: 'image', src: 'assets/media/canards/assembly.webp', alt: 'Assembled canard section of the rocket', caption: 'Canard section, assembled.' },
      { type: 'image', src: 'assets/media/canards/cfd.webp', alt: 'Ansys CFD pressure contours around a fin', caption: 'CFD around a canard.' },
      { type: 'image', src: 'assets/media/airbrakes/cad.webp', alt: 'CAD of the airbrake mechanism with a servo', caption: 'Airbrakes in CAD.' },
      { type: 'image', src: 'assets/media/airbrakes/printed.webp', alt: '3D-printed airbrake mechanism prototype', caption: 'A printed airbrake, fitted inside its housing.' },
      { type: 'image', src: 'assets/media/airbrakes/prototype.webp', alt: 'A red and white 3D-printed airbrake mechanism on a desk next to a keyboard and mouse, its white petals partly deployed from under the red ring', caption: 'Another printed airbrake, its white petals sliding out from under the red ring.' },
      { type: 'image', src: 'assets/media/canards/launch.webp', alt: 'A rocket climbing above the treeline at Launch Canada', caption: 'Launch Canada.' }
    ]
  },
  {
    slug: 'compression-sleeve',
    title: 'Compression sleeve',
    caption: 'A soft sleeve that squeezes a swollen arm in rhythm, and measures it while it works',
    year: '2026',
    where: 'Waterloo Microfluidics Lab',
    role: 'Sensors and embedded control',
    tags: ['wearables', 'soft robotics', 'flexible sensors', 'PID', 'embedded'],
    body: [
      'Lymphedema, a swelling of the arm or leg, is treated with rhythmic compression. This wearable squeezes the arm in waves with soft compression bands, so the therapy can happen at home instead of strapped to a machine.',
      'I integrated flexible printed sensors that track the limb’s volume and the pressure on it, and wrote the embedded closed-loop pressure control (PID) and its web control panel.'
    ],
    cover: { type: 'image', src: 'assets/media/sleeve/sleeve-full.webp', tone: 'dark', scrim: 'strong', aspect: 0.8, alt: 'A white mannequin wearing the compression sleeve from shoulder to glove, with clear tubes running down to a black motor pack on the belt' },
    gallery: [
      { type: 'image', src: 'assets/media/sleeve/sleeve-full.webp', alt: 'A white mannequin wearing the compression sleeve. Fabric bands sit on the upper arm and forearm, there is a cable cuff at the wrist, and clear tubes run down the chest to a black two-spool motor pack on the belt.', caption: 'The whole sleeve, on a mannequin.' },
      { type: 'video', src: 'assets/media/sleeve/sleeve-loop.mp4', poster: 'assets/media/sleeve/sleeve-loop-poster.webp', alt: 'A white mannequin arm wearing the compression sleeve. Two fabric bands on the forearm tighten and release as the drive cables pull, and the clear tubes run down to the motor pack at the waist.', caption: 'The bands tightening and letting go.' },
      { type: 'image', src: 'assets/media/sleeve/sleeve-bands.webp', alt: 'Close-up of two sleeve bands on a mannequin arm. Each has a braided cable channel, a black V-shaped hanger and a clip, with one taut line running between the bands.', caption: 'Two of the compression bands.' },
      { type: 'image', src: 'assets/media/sleeve/sleeve-drive.webp', alt: 'A black 3D-printed drive pack on a belt. It holds two grey cable spools and two small DC gear motors, with clear tubes entering from the top and coloured wires leaving at the right.', caption: 'The drive pack on the belt.' }
    ]
  },
  {
    slug: 'nightline',
    title: 'Nightline',
    caption: 'Two bedside lamps: press one, and the other, far away, starts to glow',
    year: '2026',
    where: 'Personal project',
    role: 'Everything: hardware, firmware, enclosure, networking',
    tags: ['ESP32', 'embedded C', 'audio', 'WireGuard', 'OpenSCAD'],
    body: [
      'A pair of intercom lamps, made as a gift. Press the knob and the other lamp glows and chimes. When they answer, a live audio line opens over the internet through a small WireGuard server.',
      'Turn the knob for volume, double-click to send a “goodnight” pulse of warm light, and a faint ember glow means the other lamp is online. I wrote the ESP-IDF firmware (I²S audio, LED ring, echo ducking), the server, and the parametric “sun” and “moon” enclosures.'
    ],
    cover: { type: 'image', src: 'assets/media/nightline/sun.webp', hover: 'assets/media/nightline/moon.webp', tone: 'light', bg: '#f3f2ef', aspect: 1, alt: 'Exploded render of a bedside lamp with a ridged sun-shaped crown' },
    gallery: [
      { type: 'compare', before: 'assets/media/nightline/sun.webp', after: 'assets/media/nightline/moon.webp', labels: ['sun', 'moon'], alt: 'The sun and moon versions of the lamp enclosure', caption: 'Two crowns, one for each lamp.' }
    ]
  },
  {
    slug: 'ball-joint',
    title: 'Smart sensing ball joint',
    caption: 'A car suspension joint that can tell you its own angle, ride height and wear',
    year: '2024',
    where: 'Musashi Americas',
    role: 'New Product Development Intern',
    tags: ['automotive', 'PCB design', 'magnetic sensing', 'CAN bus'],
    body: [
      'Ball joints wear out silently. At Musashi I prototyped the sensing for a ball joint that measures its own oscillation angle and axial movement with non-contact magnetic sensing, so a car can report its ride height, payload and wear. Musashi has since announced the Angle & Wear Sensing Ball Joint, powered by its patent-pending Suspension Sense™ technology.',
      'I designed a 4-layer automotive-grade PCB, wrote the acquisition firmware with CAN bus output so it plugs into the vehicle’s existing diagnostics, and ran tensile and torsional load tests on production joints.',
      'The pictures are Musashi’s own, from their announcement.'
    ],
    links: [
      { label: 'Musashi’s announcement', url: 'https://musashiamericas.com/2026/01/12/introducing-suspension-sense-technology/' }
    ],
    cover: { type: 'image', src: 'https://musashiamericas.com/wp-content/uploads/2026/01/SSMusashi2.Crop_-scaled.jpg', tone: 'dark', scrim: 'strong', lead: false, aspect: 1, alt: 'Close-up of a Suspension Sense ball joint fitted to an aluminium steering knuckle (image: Musashi Americas)' },
    gallery: [
      { type: 'image', src: 'https://musashiamericas.com/wp-content/uploads/2026/01/Musashi-E3.jpg', alt: 'Musashi product poster for Suspension Sense, the angle and wear sensing ball joint, with the sensor highlighted inside a cutaway joint', caption: 'Suspension Sense™, the angle and wear sensing ball joint. Image: Musashi Americas.' },
      { type: 'image', src: 'https://musashiamericas.com/wp-content/uploads/2026/01/SSMusashi1.Crop_-scaled.jpg', alt: 'A Suspension Sense ball joint on a demonstration suspension rig, with a placard reading Suspension Sense Ball Joint', caption: 'On a demo rig. Image: Musashi Americas.' },
      { type: 'image', src: 'https://musashiamericas.com/wp-content/uploads/2026/01/Musashi-Infographic-2048x1152.jpg', alt: 'Cross-section infographic of the ball joint, labelling angle detection, wear detection, non-contact sensing, a stand-alone design, a sealed and compact package, and CAN bus output', caption: 'What it senses, in cross-section. Image: Musashi Americas.', wide: true, edge: true },
      { type: 'image', src: 'https://musashiamericas.com/wp-content/uploads/2026/01/SSMusashiinfo.jpg', alt: 'Diagram: a magnet sensor in the joint detects the change in stud angle, which is converted into ride-height displacement over time', caption: 'From stud angle to ride height. Image: Musashi Americas.', wide: true, edge: true }
    ]
  },
  {
    slug: 'aroma',
    title: 'Aroma',
    caption: 'A diffuser that picks a scent to match the song you’re playing',
    year: '2024',
    where: 'Personal project',
    role: 'Everything: mechanical, PCB, firmware, web UI',
    tags: ['ESP32', 'PCB design', 'IoT', 'peristaltic pumps'],
    body: [
      'Inspired by the scent effects on theme-park rides. Aroma has swappable essential-oil reservoirs, peristaltic pumps to dose them and an ultrasonic atomizer.',
      'A custom ESP32 board runs the pumps, water-level sensing, an LCD, Bluetooth and a web scheduler, and the firmware changes scent to fit whatever music is playing. Try the scent switch at the bottom of this page.'
    ],
    links: [{ label: 'Code on GitHub', url: 'https://github.com/Redstone-ray/Aroma' }],
    cover: { type: 'image', src: 'assets/media/aroma/lcd.webp', fit: 'contain', tone: 'dark', bg: '#0b0b0b', aspect: 1.12, alt: 'Custom circuit board with an LCD reading Aroma, scent lavender, water low' },
    gallery: [
      { type: 'image', src: 'assets/media/aroma/render.webp', alt: 'Render of the diffuser with a bank of oil reservoirs', caption: 'The reservoir bank.' },
      { type: 'image', src: 'assets/media/aroma/reservoir.webp', alt: 'Render of a single reservoir cartridge', caption: 'One cartridge.' },
      { type: 'image', src: 'assets/media/aroma/web-ui.webp', alt: 'Web control page for the diffuser', caption: 'Scheduling from a browser.' }
    ]
  },
  {
    slug: 'ball-balancer',
    title: 'Ball balancers',
    caption: 'Machines that tilt to keep a ball exactly where you tell it to',
    year: '2025',
    where: 'University of Waterloo, third-year design project',
    role: 'Controls and modelling',
    tags: ['PID', 'computer vision', 'Simulink', 'parallel mechanisms'],
    body: [
      'Our third-year design project: a 3-DoF tilting platform and a beam balancer. We compared several PID-based control and trajectory strategies using camera and load-cell feedback, with Simulink models to check them.'
    ],
    links: [{ label: 'Code on GitHub', url: 'https://github.com/Redstone-ray/3YDP' }],
    cover: { type: 'image', src: 'assets/media/balancer/beam.webp', tone: 'light', bg: '#fbfbfc', aspect: 1.6, alt: 'CAD render of the beam balancer: a ball resting in a tilted channel beam, driven by a hobby servo through a two-bar linkage' },
    gallery: [
      { type: 'image', src: 'assets/media/balancer/beam.webp', alt: 'CAD render of the beam balancer. A grey channel beam is tilted on a pivot post, with a ball resting in it and a hobby servo driving the beam through a two-bar linkage.', caption: 'The beam balancer, in CAD.' },
      { type: 'image', src: 'assets/media/balancer/spm.webp', alt: 'CAD render of a spherical parallel manipulator. Three curved linkages connect a stepper-motor stack at the base to a tilted circular platform.', caption: 'One of our 3-DoF platform concepts, a spherical parallel manipulator, in CAD.' }
    ]
  },
  {
    slug: 'sumo',
    title: 'Sumo robot',
    caption: 'A pink, duct-taped robot that shoves other robots out of the ring',
    year: 'High school',
    where: 'Mini Sumo Autonomous, Manitoba Robot Games',
    role: 'Builder and programmer',
    tags: ['Arduino', 'autonomy', 'sensors', '1st place'],
    body: [
      'A fully autonomous mini-sumo robot. Ultrasonic “eyes” find the opponent, IR sensors keep it off the edge of the ring, and an Arduino makes the calls in real time. It runs on a LiPo with an onboard voltmeter.',
      'It took first place. You can try to survive it in the toys section below.'
    ],
    cover: { type: 'image', src: 'assets/media/sumo/robot.webp', tone: 'dark', scrim: 'strong', aspect: 1.33, alt: 'A small pink duct-taped robot with ultrasonic sensors and a voltage display' },
    gallery: [
      { type: 'image', src: 'assets/media/sumo/ring.webp', alt: 'The sumo robot moving in a black ring', caption: 'In the ring.' }
    ]
  },
  {
    slug: 'turtlebots',
    title: 'TurtleBot navigation labs',
    caption: 'Robots that drive around a pretend warehouse and stop at stop signs',
    year: '2024',
    where: 'Engineering IDEAS Clinic, University of Waterloo',
    role: 'Module developer',
    tags: ['ROS2', 'robotics', 'computer vision', 'teaching'],
    body: [
      'I wrote ROS2 navigation and control modules for Waterloo’s robotics and controls courses. TurtleBots drive through obstacle courses, act out warehouse runs and react to what they see, including stop signs.'
    ],
    cover: { type: 'image', src: 'assets/media/turtlebot/stop-sign.webp', tone: 'dark', aspect: 1, alt: 'A robot camera view with a detected stop sign in a bounding box' },
    gallery: [
      { type: 'image', src: 'assets/media/turtlebot/robot.webp', alt: 'A TurtleBot next to a cardboard obstacle', caption: 'A TurtleBot meets a box.' }
    ]
  },
  {
    slug: 'goosenator',
    title: 'The Goosenator',
    caption: 'A robot that sorts goose eggs by colour, for a campus full of geese',
    year: '2022',
    where: 'University of Waterloo, first-year project',
    role: 'Design and programming',
    tags: ['C', 'autonomy', 'colour sensing'],
    body: [
      'Waterloo has a lot of geese. Our first-year robot follows programmable paths, picks up circular “eggs”, sorts them by colour and drops them off, all in C. It started as hand sketches of the egg carrier.'
    ],
    cover: { type: 'image', src: 'assets/media/goosenator/robot.webp', hover: 'assets/media/goosenator/sketch.webp', tone: 'dark', aspect: 1.34, alt: 'A kit-built robot with a Goosenator sign' },
    gallery: [
      { type: 'compare', before: 'assets/media/goosenator/sketch.webp', after: 'assets/media/goosenator/robot.webp', labels: ['sketch', 'robot'], alt: 'Hand sketch of the mechanism and the finished robot', caption: 'From sketch to robot.' }
    ]
  }
];

// Rows on the work grid (desktop). Tiles in a row share one height; widths follow each cover's aspect.
window.LAYOUT = [
  ['blooms', 'liquafilm', 'compression-sleeve'],
  ['crystallography', 'rocketry'],
  ['nightline', 'ball-joint', 'ball-balancer'],
  ['aroma', 'sumo', 'turtlebots', 'goosenator']
];
