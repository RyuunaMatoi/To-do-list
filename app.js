
let datos = leer("datos", { tareas: [], proyectos: [] });
let vista = "pendientes";              
let tareaEditando = null;              

const COLORES = ["#3b82f6", "#38bdf8", "#2dd4bf", "#818cf8", "#a78bfa", "#f472b6", "#fbbf24"];

function leer(clave, valorPorDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : valorPorDefecto;
  } catch (error) {
    return valorPorDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (error) {
  }
}

function guardarDatos() {
  guardar("datos", datos);
}

function limpiar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function hoy() {
  const f = new Date();
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return f.getFullYear() + "-" + mes + "-" + dia;
}

function formatoFecha(fecha) {
  const partes = fecha.split("-");
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function el(id) {
  return document.getElementById(id);
}

function tareasDeLaVista() {
  const hoyTexto = hoy();
  let lista = [];

  if (vista === "pendientes") {
    lista = datos.tareas.filter((t) => !t.hecha && t.proyecto === "");
  } else if (vista === "hoy") {
    // incluye las vencidas
    lista = datos.tareas.filter((t) => !t.hecha && t.fecha !== "" && t.fecha <= hoyTexto);
  } else if (vista === "proximos") {
    lista = datos.tareas.filter((t) => !t.hecha && t.fecha > hoyTexto);
  } else if (vista === "hechas") {
    lista = datos.tareas.filter((t) => t.hecha);
  } else if (vista === "buscar") {
    const texto = el("buscador").value.trim().toLowerCase();
    if (texto !== "") {
      lista = datos.tareas.filter(
        (t) => t.titulo.toLowerCase().includes(texto) || t.desc.toLowerCase().includes(texto)
      );
    }
  } else {
    lista = datos.tareas.filter((t) => !t.hecha && t.proyecto === vista);
  }

  lista.sort((a, b) => {
    const fa = a.fecha || "9999";
    const fb = b.fecha || "9999";
    if (fa !== fb) return fa < fb ? -1 : 1;
    return a.prioridad - b.prioridad;
  });

  return lista;
}

function tituloDeLaVista() {
  const titulos = {
    pendientes: "📥 Pendientes",
    hoy: "☀️ Hoy",
    proximos: "🗓️ Próximos",
    hechas: "✅ Hechas",
    buscar: "🔍 Buscar",
  };
  if (titulos[vista]) return titulos[vista];
  const proyecto = datos.proyectos.find((p) => p.id === vista);
  return proyecto ? proyecto.nombre : "";
}

function dibujar() {
  dibujarMenu();
  dibujarTareas();
}

function dibujarMenu() {
  document.querySelectorAll("#lista-vistas button").forEach((boton) => {
    boton.classList.toggle("activa", boton.dataset.vista === vista);
  });

  let html = "";
  datos.proyectos.forEach((p) => {
    const activa = p.id === vista ? " activa" : "";
    html +=
      '<div class="proyecto' + activa + '">' +
        '<button class="ir" data-proyecto="' + p.id + '">' +
          '<span class="punto" style="background:' + p.color + '"></span>' + limpiar(p.nombre) +
        "</button>" +
        '<button class="borrar" data-borrar-proyecto="' + p.id + '" title="Eliminar proyecto">✕</button>' +
      "</div>";
  });
  el("lista-proyectos").innerHTML = html;
}

function dibujarTareas() {
  const lista = tareasDeLaVista();
  const hoyTexto = hoy();

  el("titulo-vista").textContent = tituloDeLaVista();
  el("buscador").hidden = vista !== "buscar";
  el("vacio").hidden = lista.length > 0;

  let html = "";
  lista.forEach((t) => {
    let extra = "";
    if (t.fecha !== "") {
      const vencida = !t.hecha && t.fecha < hoyTexto;
      extra += '<span class="' + (vencida ? "vencida" : "") + '">📅 ' + formatoFecha(t.fecha) + (vencida ? " (vencida)" : "") + "</span> ";
    }
    const proyecto = datos.proyectos.find((p) => p.id === t.proyecto);
    if (proyecto) {
      extra += "· " + limpiar(proyecto.nombre);
    }

    html +=
      '<div class="tarea p' + t.prioridad + (t.hecha ? " hecha" : "") + '">' +
        '<input type="checkbox" data-hecha="' + t.id + '"' + (t.hecha ? " checked" : "") + ">" +
        '<div class="info">' +
          '<div class="titulo">' + limpiar(t.titulo) + "</div>" +
          (t.desc ? '<div class="detalle">' + limpiar(t.desc) + "</div>" : "") +
          (extra ? '<div class="extra">' + extra + "</div>" : "") +
        "</div>" +
        '<div class="acciones">' +
          '<button data-editar="' + t.id + '" title="Editar">✏️</button>' +
          '<button data-borrar="' + t.id + '" title="Eliminar">🗑️</button>' +
        "</div>" +
      "</div>";
  });
  el("lista-tareas").innerHTML = html;
}

function cambiarVista(nuevaVista) {
  vista = nuevaVista;
  dibujar();
  if (vista === "buscar") el("buscador").focus();
}

function llenarSelectorProyectos(seleccionado) {
  let html = '<option value="">Sin proyecto</option>';
  datos.proyectos.forEach((p) => {
    html += '<option value="' + p.id + '">' + limpiar(p.nombre) + "</option>";
  });
  el("t-proyecto").innerHTML = html;
  el("t-proyecto").value = seleccionado;
}

function abrirVentanaTarea(id) {
  tareaEditando = id || null;
  el("form-tarea").reset();

  if (tareaEditando) {
    const t = datos.tareas.find((x) => x.id === tareaEditando);
    el("t-titulo").value = t.titulo;
    el("t-desc").value = t.desc;
    el("t-fecha").value = t.fecha;
    el("t-prioridad").value = t.prioridad;
    llenarSelectorProyectos(t.proyecto);
  } else {
    const esProyecto = datos.proyectos.some((p) => p.id === vista);
    llenarSelectorProyectos(esProyecto ? vista : "");
    if (vista === "hoy") el("t-fecha").value = hoy();
  }

  el("ventana-tarea").showModal();
  el("t-titulo").focus();
}

function guardarTarea(evento) {
  evento.preventDefault();

  const titulo = el("t-titulo").value.trim();
  if (titulo === "") return;

  const campos = {
    titulo: titulo,
    desc: el("t-desc").value.trim(),
    fecha: el("t-fecha").value,
    prioridad: Number(el("t-prioridad").value),
    proyecto: el("t-proyecto").value,
  };

  if (tareaEditando) {
    const t = datos.tareas.find((x) => x.id === tareaEditando);
    Object.assign(t, campos);
  } else {
    campos.id = "t" + Date.now();
    campos.hecha = false;
    datos.tareas.push(campos);
  }

  guardarDatos();
  el("ventana-tarea").close();
  dibujar();
}

function marcarHecha(id) {
  const t = datos.tareas.find((x) => x.id === id);
  t.hecha = !t.hecha;
  guardarDatos();
  dibujar();
}

function borrarTarea(id) {
  datos.tareas = datos.tareas.filter((t) => t.id !== id);
  guardarDatos();
  dibujar();
}

function nuevoProyecto() {
  const nombre = prompt("Nombre del proyecto:");
  if (!nombre || nombre.trim() === "") return;

  const proyecto = {
    id: "p" + Date.now(),
    nombre: nombre.trim(),
    color: COLORES[datos.proyectos.length % COLORES.length],
  };
  datos.proyectos.push(proyecto);
  guardarDatos();
  cambiarVista(proyecto.id);
}

function borrarProyecto(id) {
  const proyecto = datos.proyectos.find((p) => p.id === id);
  if (!confirm('¿Eliminar el proyecto "' + proyecto.nombre + '" y sus tareas?')) return;

  datos.proyectos = datos.proyectos.filter((p) => p.id !== id);
  datos.tareas = datos.tareas.filter((t) => t.proyecto !== id);
  if (vista === id) vista = "pendientes";
  guardarDatos();
  dibujar();
}

el("btn-nueva").addEventListener("click", () => abrirVentanaTarea());
el("btn-proyecto").addEventListener("click", nuevoProyecto);
el("form-tarea").addEventListener("submit", guardarTarea);
el("t-cancelar").addEventListener("click", () => el("ventana-tarea").close());
el("buscador").addEventListener("input", dibujarTareas);

el("lista-vistas").addEventListener("click", (e) => {
  if (e.target.dataset.vista) cambiarVista(e.target.dataset.vista);
});

el("lista-proyectos").addEventListener("click", (e) => {
  const boton = e.target.closest("button");
  if (!boton) return;
  if (boton.dataset.proyecto) cambiarVista(boton.dataset.proyecto);
  if (boton.dataset.borrarProyecto) borrarProyecto(boton.dataset.borrarProyecto);
});

el("lista-tareas").addEventListener("click", (e) => {
  const objetivo = e.target.closest("[data-hecha], [data-editar], [data-borrar]");
  if (!objetivo) return;
  if (objetivo.dataset.hecha) marcarHecha(objetivo.dataset.hecha);
  if (objetivo.dataset.editar) abrirVentanaTarea(objetivo.dataset.editar);
  if (objetivo.dataset.borrar) borrarTarea(objetivo.dataset.borrar);
});

dibujar();
