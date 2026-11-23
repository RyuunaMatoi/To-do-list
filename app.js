(() => {
  "use strict";

  /* ================= Utilidades ================= */
  const STORAGE_KEY = "marea:data";
  const LEGACY_KEY = "todo-app-v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(c));
    }
    return node;
  }

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
  };

  /* ================= Fechas ================= */
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => toISO(new Date());
  const fromISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (iso, n) => {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };
  const shortDate = (iso) => fromISO(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const weekday = (iso) => fromISO(iso).toLocaleDateString("es-CO", { weekday: "long" });

  function dateLabel(iso) {
    const t = todayISO();
    if (iso === t) return "Hoy";
    if (iso === addDays(t, 1)) return "Mañana";
    if (iso === addDays(t, -1)) return "Ayer";
    return shortDate(iso);
  }

  /* ================= Iconos ================= */
  const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 10v6M14 10v6"/></svg>',
    cal: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    flag: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h2v18H5zM8 4h11l-3 4.5L19 13H8z"/></svg>',
  };

  const VIEWS = {
    inbox: {
      title: "Pendientes",
      emptyTitle: "Todo en calma",
      emptyText: "No tienes tareas sueltas. Anota lo que se te venga a la cabeza y organízalo después.",
    },
    today: {
      title: "Hoy",
      emptyTitle: "Día despejado",
      emptyText: "No tienes nada para hoy. Disfruta el momento o planifica algo nuevo.",
    },
    upcoming: {
      title: "Próximos días",
      emptyTitle: "Nada en el horizonte",
      emptyText: "Las tareas con fecha futura aparecerán aquí, agrupadas por día.",
    },
    completed: {
      title: "Hechas",
      emptyTitle: "Aún no has terminado ninguna",
      emptyText: "Cuando marques una tarea como hecha, la verás en esta lista.",
    },
    search: {
      title: "Buscar",
      emptyTitle: "Sin resultados",
      emptyText: "Prueba con otra palabra o revisa la ortografía.",
    },
  };

  const COLORS = ["#3b82f6", "#38bdf8", "#22d3ee", "#2dd4bf", "#818cf8", "#a78bfa", "#f472b6", "#fbbf24", "#94a3b8"];

  /* ================= Estado de la app ================= */
  let state = { tasks: [], projects: [] };
  let view = "inbox";
  let query = "";
  let editingId = null;

  function loadData() {
    const data = store.get(STORAGE_KEY, null) || store.get(LEGACY_KEY, null);
    if (data && Array.isArray(data.tasks) && Array.isArray(data.projects)) return data;
    return { tasks: [], projects: [] };
  }

  function save() {
    store.set(STORAGE_KEY, state);
  }

  const projectById = (id) => state.projects.find((p) => p.id === id);

  /* ================= Lógica de datos ================= */
  function sortTasks(list) {
    return [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const da = a.due || "9999", db = b.due || "9999";
      if (da !== db) return da < db ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.createdAt - b.createdAt;
    });
  }

  function groupsForView() {
    const t = todayISO();
    const all = state.tasks;

    if (view === "inbox") return [{ tasks: sortTasks(all.filter((x) => !x.done && x.project === "inbox")) }];

    if (view === "today") {
      const overdue = all.filter((x) => !x.done && x.due && x.due < t);
      const today = all.filter((x) => !x.done && x.due === t);
      const groups = [];
      if (overdue.length) groups.push({ label: "Vencidas", cls: "overdue", tasks: sortTasks(overdue) });
      if (today.length) groups.push({ label: "Hoy", sub: `${shortDate(t)} · ${weekday(t)}`, tasks: sortTasks(today) });
      return groups;
    }

    if (view === "upcoming") {
      const future = sortTasks(all.filter((x) => !x.done && x.due && x.due > t));
      const byDate = new Map();
      future.forEach((x) => {
        if (!byDate.has(x.due)) byDate.set(x.due, []);
        byDate.get(x.due).push(x);
      });
      return [...byDate].map(([d, tasks]) => ({
        label: dateLabel(d),
        sub: `${shortDate(d)} · ${weekday(d)}`,
        tasks,
      }));
    }

    if (view === "completed") {
      return [{ tasks: all.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) }];
    }

    if (view === "search") {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return [{
        tasks: sortTasks(all.filter((x) => x.title.toLowerCase().includes(q) || (x.desc || "").toLowerCase().includes(q))),
      }];
    }

    if (view.startsWith("p:")) {
      const id = view.slice(2);
      return [{ tasks: sortTasks(all.filter((x) => !x.done && x.project === id)) }];
    }
    return [];
  }

  /* ================= Render ================= */
  function render() {
    renderSidebar();
    renderMain();
  }

  function greeting() {
    const hr = new Date().getHours();
    return hr < 12 ? "Buenos días" : hr < 19 ? "Buenas tardes" : "Buenas noches";
  }

  function renderSidebar() {
    const t = todayISO();
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));

    const inboxCount = state.tasks.filter((x) => !x.done && x.project === "inbox").length;
    const todayCount = state.tasks.filter((x) => !x.done && x.due && x.due <= t).length;
    $('[data-count="inbox"]').textContent = inboxCount || "";
    $('[data-count="today"]').textContent = todayCount || "";

    const list = $("#projectList");
    list.replaceChildren();
    if (!state.projects.length) list.append(h("li", { class: "no-projects" }, "Aún no tienes proyectos"));

    state.projects.forEach((p) => {
      const count = state.tasks.filter((x) => !x.done && x.project === p.id).length;
      list.append(
        h("li", { class: "project-item" + (view === "p:" + p.id ? " active" : "") },
          h("button", { class: "project-btn", onclick: () => go("p:" + p.id) },
            h("span", { class: "dot", style: `background:${p.color}` }),
            h("span", { class: "name" }, p.name),
            h("span", { class: "count font-mono text-muted text-[11.5px]" }, count || "")
          ),
          h("button", {
            class: "project-del", title: "Eliminar proyecto", "aria-label": "Eliminar proyecto " + p.name,
            html: ICONS.trash,
            onclick: () => deleteProject(p.id),
          })
        )
      );
    });
  }

  function renderMain() {
    const list = $("#taskList");
    list.replaceChildren();
    $("#greeting").textContent = greeting();

    const proj = view.startsWith("p:") ? projectById(view.slice(2)) : null;
    $("#viewTitle").textContent = proj ? proj.name : VIEWS[view].title;

    const icon = $("#viewIcon");
    icon.replaceChildren();
    if (proj) {
      icon.append(h("span", { class: "dot", style: `background:${proj.color}` }));
    } else {
      const src = $(`.nav-item[data-view="${view}"] svg`);
      if (src) {
        const clone = src.cloneNode(true);
        clone.setAttribute("width", "24");
        clone.setAttribute("height", "24");
        icon.append(clone);
      }
    }

    $("#searchBox").hidden = view !== "search";
    $("#addInline").hidden = view === "search" || view === "completed";

    const groups = groupsForView();
    const total = groups.reduce((n, g) => n + g.tasks.length, 0);

    const summary = $("#summary");
    summary.textContent = total ? `${total} ${view === "completed" ? (total === 1 ? "hecha" : "hechas") : (total === 1 ? "tarea" : "tareas")}` : "";

    const empty = $("#emptyState");
    empty.hidden = total > 0;
    if (!total) {
      const searching = view === "search" && !query.trim();
      const info = proj
        ? { emptyTitle: "Proyecto vacío", emptyText: "Añade la primera tarea de este proyecto." }
        : VIEWS[view];
      $("#emptyTitle").textContent = searching ? "¿Qué estás buscando?" : info.emptyTitle;
      $("#emptyText").textContent = searching ? "Escribe arriba para filtrar por nombre o descripción." : info.emptyText;
      $("#addEmpty").hidden = view === "search" || view === "completed";
      $("#addInline").hidden = true;
    }

    groups.forEach((g) => {
      if (g.label) {
        list.append(h("div", { class: "group-title " + (g.cls || "") }, g.label, g.sub ? h("small", {}, g.sub) : null));
      }
      g.tasks.forEach((task) => list.append(taskRow(task)));
    });
  }

  function taskRow(task) {
    const t = todayISO();
    const proj = task.project !== "inbox" ? projectById(task.project) : null;
    const chips = [];

    if (task.due) {
      let cls = "";
      if (!task.done) {
        if (task.due < t) cls = "overdue";
        else if (task.due === t) cls = "today";
        else if (task.due === addDays(t, 1)) cls = "soon";
      }
      chips.push(h("span", { class: "chip " + cls }, h("span", { html: ICONS.cal }), dateLabel(task.due)));
    }
    if (task.priority < 4) {
      chips.push(h("span", { class: "chip prio" }, h("span", { html: ICONS.flag }), "P" + task.priority));
    }
    if (proj && !view.startsWith("p:")) {
      chips.push(h("span", { class: "chip" }, h("span", { class: "dot", style: `background:${proj.color}` }), proj.name));
    }

    const row = h("div", { class: `task p${task.priority}` + (task.done ? " done" : "") },
      h("button", {
        class: "check",
        title: task.done ? "Marcar como pendiente" : "Completar tarea",
        "aria-label": task.done ? "Marcar como pendiente" : "Completar tarea",
        html: ICONS.check,
        onclick: () => toggleTask(task.id, row),
      }),
      h("div", { class: "task-body" },
        h("div", { class: "task-title" }, task.title),
        task.desc ? h("div", { class: "task-desc" }, task.desc) : null,
        chips.length ? h("div", { class: "task-meta" }, chips) : null
      ),
      h("div", { class: "task-actions" },
        h("button", { class: "icon-btn w-7 h-7 rounded-md grid place-items-center text-muted hover:bg-white/[0.06] hover:text-text cursor-pointer transition-colors", title: "Editar", "aria-label": "Editar tarea", html: ICONS.edit, onclick: () => openTaskDialog(task.id) }),
        h("button", { class: "icon-btn del w-7 h-7 rounded-md grid place-items-center text-muted cursor-pointer transition-colors", title: "Eliminar", "aria-label": "Eliminar tarea", html: ICONS.trash, onclick: () => deleteTask(task.id) })
      )
    );
    return row;
  }

  /* ================= Acciones ================= */
  function go(next) {
    view = next;
    if (window.innerWidth < 768) $("#app").classList.add("sidebar-closed");
    render();
    if (view === "search") $("#searchInput").focus();
  }

  function toggleTask(id, row) {
    const task = state.tasks.find((x) => x.id === id);
    if (!task) return;
    task.done = !task.done;
    task.doneAt = task.done ? Date.now() : null;
    save();
    row.classList.toggle("done", task.done);
    renderSidebar();
    setTimeout(renderMain, 350);
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((x) => x.id !== id);
    save();
    render();
  }

  function deleteProject(id) {
    const p = projectById(id);
    if (!p) return;
    const n = state.tasks.filter((x) => x.project === id).length;
    const msg = n
      ? `¿Eliminar el proyecto "${p.name}" y sus ${n} tarea(s)?`
      : `¿Eliminar el proyecto "${p.name}"?`;
    if (!confirm(msg)) return;
    state.projects = state.projects.filter((x) => x.id !== id);
    state.tasks = state.tasks.filter((x) => x.project !== id);
    if (view === "p:" + id) view = "inbox";
    save();
    render();
  }

  /* ================= Diálogo de tarea ================= */
  const taskDialog = $("#taskDialog");
  const taskForm = $("#taskForm");
  const taskTitle = $("#taskTitle");

  function fillProjectSelect(selected) {
    const sel = $("#projectSelect");
    sel.replaceChildren(h("option", { value: "inbox" }, "Pendientes (sin proyecto)"));
    state.projects.forEach((p) => sel.append(h("option", { value: p.id }, p.name)));
    sel.value = selected;
  }

  function openTaskDialog(id = null) {
    editingId = id;
    taskForm.reset();
    const task = id ? state.tasks.find((x) => x.id === id) : null;

    if (task) {
      taskTitle.value = task.title;
      $("#taskDesc").value = task.desc || "";
      $("#taskDue").value = task.due || "";
      $("#taskPriority").value = String(task.priority);
      fillProjectSelect(task.project);
      $("#saveTask").textContent = "Guardar cambios";
    } else {
      fillProjectSelect(view.startsWith("p:") ? view.slice(2) : "inbox");
      if (view === "today") $("#taskDue").value = todayISO();
      $("#saveTask").textContent = "Añadir tarea";
    }
    $("#saveTask").disabled = !taskTitle.value.trim();
    taskDialog.showModal();
    taskTitle.focus();
  }

  taskTitle.addEventListener("input", () => {
    $("#saveTask").disabled = !taskTitle.value.trim();
  });

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = taskTitle.value.trim();
    if (!title) return;
    const data = {
      title,
      desc: $("#taskDesc").value.trim(),
      due: $("#taskDue").value,
      priority: Number($("#taskPriority").value),
      project: $("#projectSelect").value,
    };
    if (editingId) {
      Object.assign(state.tasks.find((x) => x.id === editingId), data);
    } else {
      state.tasks.push({ id: uid(), done: false, doneAt: null, createdAt: Date.now(), ...data });
    }
    save();
    taskDialog.close();
    render();
  });

  $("#cancelTask").addEventListener("click", () => taskDialog.close());

  /* ================= Diálogo de proyecto ================= */
  const projectDialog = $("#projectDialog");
  const projectForm = $("#projectForm");

  function buildSwatches() {
    const box = $("#swatches");
    box.replaceChildren();
    COLORS.forEach((c, i) => {
      box.append(
        h("label", { title: c },
          h("input", { type: "radio", name: "color", value: c, checked: i === 0 ? "checked" : false }),
          h("span", { style: `background:${c}` })
        )
      );
    });
  }

  $("#addProject").addEventListener("click", () => {
    projectForm.reset();
    buildSwatches();
    projectDialog.showModal();
    $("#projectName").focus();
  });

  projectForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#projectName").value.trim();
    if (!name) return;
    const color = (projectForm.querySelector('input[name="color"]:checked') || {}).value || COLORS[0];
    const p = { id: uid(), name, color };
    state.projects.push(p);
    save();
    projectDialog.close();
    go("p:" + p.id);
  });

  $("#cancelProject").addEventListener("click", () => projectDialog.close());

  [taskDialog, projectDialog].forEach((d) =>
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); })
  );

  /* ================= Eventos generales ================= */
  $$(".nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  ["openAdd", "addInline", "addEmpty"].forEach((id) =>
    $("#" + id).addEventListener("click", () => openTaskDialog())
  );

  $("#searchInput").addEventListener("input", (e) => {
    query = e.target.value;
    renderMain();
  });

  const appEl = $("#app");
  $("#closeSidebar").addEventListener("click", () => appEl.classList.add("sidebar-closed"));
  $("#openSidebar").addEventListener("click", () => appEl.classList.remove("sidebar-closed"));

  // Atajo: "n" abre el formulario de nueva tarea
  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement || {}).tagName;
    if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      openTaskDialog();
    }
  });

  // Refresca al cambiar de día con la pestaña abierta
  let lastDay = todayISO();
  setInterval(() => {
    if (todayISO() !== lastDay) {
      lastDay = todayISO();
      render();
    }
  }, 60000);

  /* ================= Inicio ================= */
  if (window.innerWidth < 768) appEl.classList.add("sidebar-closed");
  state = loadData();
  render();
})();