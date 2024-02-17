"use strict";
(() => {
  // src/utils/utils.ts
  async function callAPI(action, data, useLogin = true) {
    function safeParse(str) {
      return safe(() => JSON.parse(str));
    }
    let login2 = null;
    if (useLogin) {
      const loginData = load("login");
      login2 = {
        user: loginData.id,
        userToken: loginData.token
      };
    }
    const response = await fetch("/api/prinzeugen/main", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(Object.assign({
        action
      }, data, login2))
    });
    const raw = await response.text();
    const payload = safeParse(raw) || raw;
    if (response.status != 200)
      console.error(raw);
    return {
      status: response.status,
      headers: response.headers,
      data: payload
    };
  }
  function chunk(a, chunksize) {
    let r = [];
    for (let i = 0; i < a.length; i += chunksize) {
      r.push(a.slice(i, i + chunksize));
    }
    return r;
  }
  function fromTemplate(id) {
    return document.querySelector(`template#${id}`)?.content.cloneNode(true) ?? null;
  }
  function safe(cb) {
    try {
      return cb();
    } catch (e) {
      return null;
    }
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function setElementValue(query, value, propertyName = "value") {
    const e = document.querySelector(query);
    if (e === null)
      return;
    e[propertyName] = value;
  }
  function load(key) {
    return JSON.parse(localStorage.getItem(key) || "null");
  }
  function save(key, data) {
    if (data)
      localStorage.setItem(key, JSON.stringify(data));
    else
      localStorage.removeItem(key);
  }

  // src/utils/io.ts
  function listenToKeyboard(preventDefault, mappings) {
    document.addEventListener("keydown", (e) => {
      const mapping = mappings.find((m) => m.keys.includes(e.code));
      if (mapping) {
        if (preventDefault)
          e.preventDefault();
        mapping.action();
      }
    });
  }

  // src/utils/tabs.ts
  function switchTabContent(group, target, content) {
    const container = document.querySelector(`*[data-tab-container="${group}"]`);
    if (!container) {
      if (!target)
        return;
      const variants = document.querySelectorAll(`*[data-tab-variant-group="${group}"]`);
      if (variants.length === 0)
        return;
      variants.forEach((v) => {
        if (v.dataset.tabVariant === target) {
          v.classList.remove("hidden");
        } else {
          v.classList.add("hidden");
        }
      });
      return;
    }
    ;
    const contents = target === null ? content : fromTemplate(`${group}-${target}`);
    if (!contents)
      return;
    const storage = new DocumentFragment();
    storage.append(...container.childNodes);
    container.replaceChildren(contents);
    updateTabListeners(container);
    return storage;
  }
  function updateTabListeners(root = document) {
    const allTabs = root.querySelectorAll(".tab");
    allTabs.forEach((tab) => {
      const group = tab.dataset.tabGroup;
      const tabId = tab.dataset.tabId;
      if (group === void 0 || tabId === void 0)
        return;
      const sibs = root.querySelectorAll(`.tab[data-tab-group="${group}"]`);
      tab.addEventListener("click", () => {
        if (tab.classList.contains("selected"))
          return;
        sibs.forEach((t) => t.classList.remove("selected"));
        tab.classList.add("selected");
        switchTabContent(group, tabId);
      });
    });
    root.querySelectorAll("[data-tab-container]").forEach((container) => {
      const tab = container.dataset.tabDefault;
      if (tab) {
        const group = container.dataset.tabContainer;
        if (group === void 0)
          return;
        switchTabContent(group, tab);
      }
    });
  }

  // src/utils/curtain.ts
  var pageLock = false;
  var nodeStorage;
  function pullCurtain(lock, message = "Processing request", noswitch = false) {
    if (lock) {
      if (pageLock)
        return false;
      pageLock = true;
      nodeStorage = switchTabContent("state", "curtain");
      updateCurtainMessage(message);
    } else {
      pageLock = false;
      if (!noswitch)
        switchTabContent("state", null, nodeStorage);
      nodeStorage = void 0;
    }
    return true;
  }
  function updateCurtainMessage(message) {
    const curtain = document.querySelector("#curtain");
    if (curtain)
      curtain.textContent = message;
  }

  // src/utils/flicker.ts
  function genericFlickerUpdate(taQ, flQ, cb, root = document) {
    const textarea = root.querySelector(taQ);
    const flicker = root.querySelector(flQ);
    if (!flicker)
      return;
    const contents = textarea?.value.trim() ?? "";
    const [text, color = "transparent"] = cb(contents);
    flicker.textContent = text;
    flicker.style.backgroundColor = color;
  }

  // src/utils/console.ts
  function init() {
    const console2 = document.querySelector(".console");
    if (!console2)
      return;
    console2.addEventListener("toggle", () => console2.dataset.unread = "0");
  }
  function report(message) {
    const console2 = document.querySelector("details.console");
    if (!console2)
      return;
    if (console2.dataset.unread === void 0)
      console2.dataset.unread = "0";
    if (!console2.open)
      console2.dataset.unread = `${parseInt(console2.dataset.unread, 10) + 1}`;
    const contents = console2.querySelector("details > div");
    if (!contents)
      return;
    const entry = document.createElement("div");
    entry.textContent = message;
    contents.prepend(entry);
  }

  // src/utils/themes.ts
  function init2() {
    const theme = window.localStorage.getItem("theme");
    if (theme)
      switchTheme(theme);
  }
  function selectorList() {
    const rules = [];
    for (const ss of document.styleSheets)
      if (ss.href?.startsWith(window.location.href)) {
        const raw = [...ss.cssRules];
        rules.push(...raw.filter((r) => r.constructor.name === "CSSStyleRule"));
      }
    const themes = rules.map((r) => r.selectorText.match(/\.theme-(.*)/)).filter((r) => r);
    const container = new DocumentFragment();
    container.append(...themes.map((t) => selectorItem(...t)));
    return container;
  }
  function selectorItem(cssSelector, name) {
    const button = fromTemplate("theme-selector");
    if (!button)
      return null;
    const svg = button.firstElementChild;
    if (!svg)
      return null;
    const themeClassName = `theme-${name}`;
    svg.classList.add(themeClassName);
    svg.addEventListener("click", () => switchTheme(themeClassName));
    return svg;
  }
  function switchTheme(themeClassName) {
    document.body.classList.forEach((c) => {
      if (c.startsWith("theme-"))
        document.body.classList.remove(c);
    });
    document.body.classList.add(themeClassName);
    window.localStorage.setItem("theme", themeClassName);
  }

  // src/utils/forms.ts
  function fieldSchema(key, type, additional) {
    return {
      key,
      type,
      additional
    };
  }
  function fieldFromTemplate(field) {
    function getProto(id) {
      const raw = fromTemplate(id);
      const proto = raw?.firstElementChild;
      if (proto) {
        return proto;
      } else {
        console.error(`Failed to render form field from template "${id}"`);
        return null;
      }
    }
    switch (field.type) {
      case "line": {
        const templateName = "generic-field-line";
        const proto = getProto(templateName);
        if (!proto)
          return null;
        const label = proto.querySelector("label");
        if (label)
          label.textContent = field.additional.label;
        const input = proto.querySelector("input");
        if (!input) {
          console.error(`Can't find <input> inside "${templateName}" template`);
          return null;
        }
        ;
        input.placeholder = field.additional.placeholder ?? "";
        input.setAttribute(`data-grabber-form-${field.key}`, "");
        return proto;
      }
      case "list": {
        const templateName = "generic-field-multiline";
        const proto = getProto(templateName);
        if (!proto)
          return null;
        const label = proto.querySelector("label");
        if (label)
          label.textContent = field.additional.label;
        const textarea = proto.querySelector("textarea");
        if (!textarea) {
          console.error(`Can't find <textarea> inside "${templateName}" template`);
          return null;
        }
        textarea.placeholder = field.additional.placeholder ?? "";
        textarea.setAttribute(`data-grabber-form-${field.key}`, "");
        if (field.additional.lineCount) {
          const textareaFU = () => genericFlickerUpdate(
            "textarea",
            "legend > span",
            (content) => [`${content.split("\n").filter((line) => line.trim().length > 0).length}`, void 0],
            proto
          );
          textarea.addEventListener("input", textareaFU);
        }
        return proto;
      }
    }
  }
  function renderForm(schema) {
    const container = new DocumentFragment();
    const rendered = schema.map((s) => fieldFromTemplate(s)).filter((s) => s !== null);
    container.append(...rendered);
    return container;
  }
  function getFieldElement(container, fieldKey) {
    return container.querySelector(`*[data-grabber-form-${fieldKey}]`);
  }
  function readForm(container, schema) {
    function readField(fieldKey, fieldType) {
      const fieldElement = getFieldElement(container, fieldKey);
      if (!fieldElement)
        return null;
      return fieldElement?.value ?? null;
    }
    const r = {};
    schema.forEach((s) => {
      const v = readField(s.key, s.type);
      r[s.key] = v;
    });
    return r;
  }
  function fillForm(form, data) {
    for (const key of Object.keys(data)) {
      const field = getFieldElement(form, key);
      if (field) {
        field.value = data[key];
        field.dispatchEvent(new Event("input"));
      }
    }
    return form;
  }

  // src/utils/grabbers.ts
  function tagList(raw) {
    return raw.split("\n").map((line) => line.trim().replaceAll(" ", "_")).filter((tag) => tag != "");
  }
  var GLB_FORM = [
    fieldSchema("user", "line", {
      label: "Gelbooru user"
    }),
    fieldSchema("api", "line", {
      label: "Gelbooru API key"
    }),
    fieldSchema("tags", "list", {
      label: "Tags",
      lineCount: true
    }),
    fieldSchema("whitelist", "list", {
      label: "Whitelist",
      placeholder: "sort:id:asc and id:>lastseen are added autmoatically",
      lineCount: true
    }),
    fieldSchema("blacklist", "list", {
      label: "Blacklist",
      lineCount: true
    }),
    fieldSchema("lastSeen", "line", {
      label: "Last checked post ID"
    })
  ];
  var GelbooruGrabber = {
    type: "gelbooru",
    form: GLB_FORM,
    read: (container) => {
      const formData = readForm(container, GLB_FORM);
      const instance = {
        type: "gelbooru",
        credentials: {
          user: parseInt(formData.user?.trim() ?? "0", 10),
          token: formData.api?.trim()
        },
        config: {
          tags: formData.tags ? tagList(formData.tags) : [""],
          whites: formData.whitelist ? tagList(formData.whitelist) : [""],
          blacks: formData.blacklist ? tagList(formData.blacklist) : [""],
          moderated: true
        },
        state: {
          lastSeen: parseInt(formData.lastSeen ?? "0", 10)
        }
      };
      return instance;
    },
    fill: (container, data) => {
      const formData = {
        user: `${data.credentials.user}`,
        api: data.credentials.token,
        tags: data.config.tags.join("\n"),
        blacklist: data.config.blacks.join("\n"),
        whitelist: data.config.whites.join("\n"),
        lastSeen: `${data.state.lastSeen}`
      };
      fillForm(container, formData);
    }
  };
  var Grabbers = {
    "gelbooru": GelbooruGrabber
  };

  // src/moderation.ts
  async function downloadModerables() {
    const messages = await callAPI("getModerables", null, true);
    if (messages.status == 200)
      return messages.data;
    else
      return null;
  }
  async function reloadModerables() {
    pullCurtain(true);
    const messages = await downloadModerables();
    pullCurtain(false);
    if (messages)
      displayModerables(messages);
  }
  function displayModerables(messages) {
    const list = document.querySelector("#moderables-list");
    if (!list)
      return;
    list.innerHTML = "";
    messages.forEach((m) => {
      const item = renderModerable(m.message, m.id);
      if (item)
        list.append(item);
    });
  }
  function renderModerable(message, id) {
    if (message.version != 3) {
      console.error("Unsupported message version");
      return;
    }
    const proto = fromTemplate("generic-moderable")?.firstElementChild;
    if (!proto)
      return;
    proto.dataset.id = id;
    proto.dataset.original = message.content;
    if (message.cached)
      proto.dataset.upscaled = "weewee";
    proto.addEventListener("click", () => proto.focus());
    const preview = message.cached ? message.cachedContent.preview : message.preview;
    const source = message.links[0].url;
    const link = proto.querySelector("a");
    if (link)
      link.href = source;
    const image = proto.querySelector("img");
    if (image)
      image.src = preview;
    function renderTag(text, color) {
      const e = document.createElement("div");
      e.className = "rounded bordered padded";
      e.textContent = text;
      e.style.backgroundColor = color;
      return e;
    }
    const tags = proto.querySelector(".moderable-info");
    if (tags) {
      if (message.artists)
        message.artists.forEach(
          (artist) => tags.append(renderTag(`\u{1F3A8} ${artist}`, "transparent"))
        );
      if (message.nsfw)
        tags.append(renderTag("NSFW", "rgba(200, 0, 0, .3"));
      if (message.tags?.includes("animated"))
        tags.append(renderTag("animated", "rgba(50, 50, 200, .3"));
      if (message.tags?.includes("animated_gif"))
        tags.append(renderTag("GIF", "rgba(50, 50, 200, .3"));
      if (message.tags?.includes("video"))
        tags.append(renderTag("video", "rgba(50, 50, 200, .3"));
    }
    proto.querySelectorAll("[data-moderable-button]").forEach((b) => {
      if (b.dataset.moderableButton === "approve") {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          proto.classList.remove("rejected");
          proto.classList.add("approved");
        });
      } else {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          proto.classList.add("rejected");
          proto.classList.remove("approved");
        });
      }
    });
    proto.addEventListener("focusin", () => proto.scrollIntoView({
      /*behavior: "smooth", */
      block: "center"
    }));
    proto.addEventListener("mousedown", (e) => e.preventDefault());
    return proto;
  }
  var UPSCALE_RETRY_COUNT = 3;
  async function upscalePreviews() {
    async function upscale(e, retriesLeft = UPSCALE_RETRY_COUNT) {
      if (e.dataset.upscaled && retriesLeft === UPSCALE_RETRY_COUNT)
        return;
      e.dataset.upscaled = "weewee";
      const url = `/api/imgproxy/?j=1&w=0&url=${e.dataset.original}`;
      const response = await fetch(url);
      if (response.status === 504) {
        if (retriesLeft <= 0)
          return;
        await sleep(Math.random() * 5e3);
        await upscale(e, retriesLeft - 1);
        return;
      }
      if (!response.ok)
        return;
      if (!response.headers.get("content-type")?.startsWith("image/"))
        return;
      const data = await response.arrayBuffer();
      const blob = new Blob([data]);
      const image = e.querySelector("img");
      if (image)
        image.src = URL.createObjectURL(blob);
    }
    const moderables = Array.from(document.querySelectorAll(".moderable"));
    const chomnks = chunk(moderables, 7);
    for (const chonk of chomnks) {
      const scaleJobs = chonk.map((e) => upscale(e));
      await Promise.allSettled(scaleJobs);
    }
    ;
  }
  function fixFocus() {
    const target = document.querySelector(".moderable:not(.approved):not(.rejected)");
    if (target)
      target.focus();
    else
      document.querySelector(".moderable")?.focus();
  }
  function decide(approve) {
    const focused = document.activeElement;
    if (!focused?.classList.contains("moderable"))
      return;
    const buttonQuery = `button[data-moderable-button="${approve ? "approve" : "reject"}"]`;
    focused.querySelector(buttonQuery)?.click();
    const nextSib = focused.nextElementSibling;
    if (nextSib?.classList.contains("moderable"))
      nextSib.focus();
    else
      document.querySelector("#moderables-submit")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  async function moderate() {
    const decisionsCards = document.querySelectorAll(".moderable.approved, .moderable.rejected");
    const decisions = Array.from(decisionsCards).map((d) => ({
      id: parseInt(d.dataset.id ?? "", 10),
      approved: d.classList.contains("approved")
    }));
    if (decisions.length == 0)
      return;
    pullCurtain(true);
    const newModerables = await callAPI("moderate", { decisions }, true);
    pullCurtain(false);
    displayModerables(newModerables.data);
  }

  // src/grabbing.ts
  async function downloadGrabbers() {
    const grabbers = await callAPI("getGrabbers", {}, true);
    if (grabbers.status == 200)
      return grabbers.data;
    else
      return null;
  }
  function displayGrabbers(grabs) {
    const list = document.querySelector("#grabbers-list");
    if (!list)
      return;
    list.innerHTML = "";
    grabs.forEach((g, i) => {
      const meta = Grabbers[g.type];
      const proto = renderGrabber(g.type, i);
      if (!proto)
        return;
      meta.fill(proto, g);
      list.appendChild(proto);
    });
  }
  async function batchGrab() {
    pullCurtain(true);
    const grabbersReference = await downloadGrabbers();
    if (!grabbersReference) {
      pullCurtain(false);
      return;
    }
    let newRows = [];
    for (let i = 0; i < grabbersReference.length; ++i) {
      updateCurtainMessage(`Grabbing: ${i} / ${grabbersReference.length} done`);
      const response = await callAPI("grab", { id: i }, true);
      if (response.status != 200) {
        report(`Grab #${i} failed`);
        console.error(response);
      } else
        newRows.push(...response.data);
    }
    report(`${newRows.length} new entries`);
    afterGrab();
  }
  async function selectiveGrab(grabberId, batchSize) {
    pullCurtain(true);
    let newRows = [];
    const params = {
      id: grabberId,
      ...batchSize ? { batchSize } : {}
    };
    updateCurtainMessage(`Grabbing #${grabberId}`);
    const response = await callAPI("grab", params, true);
    if (response.status != 200) {
      report(`Grab #${grabberId} failed`);
      console.error(response);
    } else
      newRows.push(...response.data);
    report(`${newRows.length} new entries`);
    afterGrab();
  }
  async function afterGrab() {
    updateCurtainMessage(`Updating state`);
    const updateGrabbers = await downloadGrabbers();
    const updateModerables = await downloadModerables();
    pullCurtain(false);
    if (updateGrabbers)
      displayGrabbers(updateGrabbers);
    if (updateModerables)
      displayModerables(updateModerables);
  }
  async function saveGrabbers() {
    const list = document.querySelector("#grabbers-list");
    const grabs = Array.from(list?.children ?? []).map((el) => {
      const container = el;
      return Grabbers[container?.dataset.grabberForm].read(container);
    });
    pullCurtain(true);
    const response = await callAPI("setGrabbers", {
      grabbers: grabs
    });
    const updateGrabbers = response.status === 200 ? await downloadGrabbers() : null;
    pullCurtain(false);
    if (updateGrabbers)
      displayGrabbers(updateGrabbers);
  }
  function addGrabber(type) {
    const list = document.querySelector("#grabbers-list");
    const proto = renderGrabber(type);
    if (proto && list)
      list.appendChild(proto);
  }
  function renderGrabber(type, index) {
    const meta = Grabbers[type];
    if (!meta)
      return null;
    const proto = fromTemplate("generic-grabber")?.firstElementChild;
    if (!proto)
      return null;
    const buttons = proto.querySelector("div");
    if (!buttons)
      return null;
    proto.dataset.grabberForm = type;
    proto.appendChild(renderForm(meta.form));
    const [grab, less, remv] = [
      buttons.querySelector(`[data-grabber-button="grab"]`),
      buttons.querySelector(`[data-grabber-button="less"]`),
      buttons.querySelector(`[data-grabber-button="remv"]`)
    ];
    remv?.addEventListener("click", () => {
      proto.remove();
    });
    if (index === void 0) {
      const hint = document.createElement("div");
      hint.textContent = "Save grabbers before grabbing";
      proto.insertBefore(hint, proto.children[0]);
      if (grab)
        grab.disabled = true;
      if (less)
        less.disabled = true;
    } else {
      if (grab)
        grab.addEventListener("click", () => selectiveGrab(index));
      if (less)
        less.addEventListener("click", () => selectiveGrab(index, 50));
    }
    proto.appendChild(buttons);
    return proto;
  }

  // src/pool.ts
  var PLACEHOLDER_URL = "placeholder.png";
  async function loadMessagePool(page = 0) {
    const STRIDE = 64;
    const container = document.querySelector("#pool-content");
    if (!container)
      return;
    const pager = document.querySelector("#pool-pagination");
    if (!pager)
      return;
    container.innerHTML = "";
    pullCurtain(true);
    const rows = await callAPI("getPoolPage", {
      page,
      stride: STRIDE
    }, true);
    pullCurtain(false);
    for (let row of rows.data.rows) {
      const proto = fromTemplate("generic-pool-item")?.firstElementChild;
      if (!proto)
        return;
      proto.dataset.id = row.id;
      const img = proto.querySelector("img");
      if (!img)
        return;
      img.title = generateTitle(row);
      if (row.message.version == 1) {
        img.src = row.message.raw?.preview || row.message.image[0];
      } else if (row.message.version == 3) {
        img.src = row.message.cached ? row.message.cachedContent.preview : row.message.preview;
      } else {
        img.src = PLACEHOLDER_URL;
      }
      proto.addEventListener("click", () => setPreviewPost(row));
      container.append(proto);
    }
    pager.innerHTML = "";
    const postCount = rows.data.count;
    const pageCount = Math.ceil(postCount / STRIDE);
    for (let i = 0; i < pageCount; ++i) {
      const pageSelector = document.createElement("button");
      pageSelector.textContent = `${i + 1}`;
      pageSelector.addEventListener("click", () => loadMessagePool(i));
      pager.appendChild(pageSelector);
    }
  }
  function setPreviewPost(row) {
    const dialog = document.querySelector("dialog#pool-preview");
    if (!dialog)
      return;
    const picture = dialog.querySelector("img");
    if (!picture)
      return;
    if (row.message.version == 3) {
      picture.src = row.message.cached ? row.message.cachedContent.preview : row.message.preview;
    } else {
      picture.src = row ? row.message.raw.preview || row.message.image[0] : PLACEHOLDER_URL;
    }
    picture.title = generateTitle(row);
    const controls = dialog.querySelector("#pool-preview-controls");
    if (!controls)
      return;
    controls.innerHTML = "";
    function button(caption, action) {
      const b = document.createElement("button");
      b.textContent = caption;
      b.addEventListener("click", action);
      return b;
    }
    const linkset = row.message?.links || [];
    const links = linkset.map((link) => {
      const anchor = document.createElement("a");
      anchor.textContent = link.text;
      anchor.href = link.url;
      anchor.classList.add("clickable");
      anchor.target = "_blank";
      return anchor;
    });
    controls.append(
      ...links,
      button("Unschedule", () => unschedulePost(row.id).then(() => dialog.close())),
      button("Show item details in console", () => console.log(row))
    );
    dialog.showModal();
  }
  async function unschedulePost(rowId) {
    pullCurtain(true);
    const response = await callAPI("unschedulePost", {
      id: rowId
    }, true);
    pullCurtain(false);
    if (response.status < 300) {
      const target = document.querySelector(`.pool-item[data-id="${rowId}"]`);
      if (target)
        target.classList.add("hidden");
    }
  }
  function generateTitle(row) {
    return [
      row.message.artists?.join(" "),
      row.message.tags?.join(" ")
    ].join("\n");
  }

  // src/main.ts
  main();
  async function main() {
    init2();
    updateTabListeners();
    window.addEventListener("error", (event) => {
      report(`${event.message}

${event.filename} ${event.lineno}:${event.colno}`);
    });
    document.querySelector("#form-login")?.addEventListener("submit", (e) => login(e));
    const loginData = load("login");
    if (loginData != null) {
      pullCurtain(true, "Loading");
      const loginResponse = await callAPI("login", {
        user: loginData.id,
        userToken: loginData.token
      }, false);
      pullCurtain(false);
      if (loginResponse.status == 200)
        authorize(loginResponse.data);
    }
    listenToKeyboard(false, [
      {
        keys: ["Comma"],
        action: () => decide(true)
      },
      {
        keys: ["Period"],
        action: () => decide(false)
      },
      {
        keys: ["Digit0"],
        action: () => upscalePreviews()
      },
      {
        keys: ["ShiftRight", "KeyM"],
        action: () => fixFocus()
      }
    ]);
  }
  async function authorize(userData) {
    switchTabContent("state", "online");
    setElementValue("#settings-password", "");
    setElementValue("#settings-tg-token", userData.tg_token);
    setElementValue("#settings-additional", userData.additional);
    document.querySelector("#settings-additional")?.addEventListener("input", updateSettingsFlicker);
    updateSettingsFlicker();
    document.querySelectorAll("[data-add-grabber]").forEach(
      (b) => b.addEventListener("click", () => {
        if (b.dataset.addGrabber === void 0)
          return;
        addGrabber(b.dataset.addGrabber);
      })
    );
    function addClick(query, action) {
      document.querySelector(query)?.addEventListener("click", action);
    }
    addClick("#dashboard-grab", batchGrab);
    addClick("#grabbers-save", saveGrabbers);
    addClick("#moderables-reload", reloadModerables);
    addClick("#moderables-upscale", upscalePreviews);
    addClick("#moderables-submit", moderate);
    addClick("#pool-load", () => loadMessagePool());
    addClick("#settings-save", saveSettings);
    addClick("#settings-signout", signOut);
    init();
    document.querySelector("#settings-theme")?.append(selectorList());
    displayGrabbers(userData.grabbers);
    displayModerables(userData.moderables);
    report(`Welcome back, ${userData.name}. You have ${userData.postsScheduled} post${userData.postsScheduled == 1 ? "" : "s"} in pool, ${userData.moderables.length} pending moderation`);
  }
  async function login(e) {
    e.preventDefault();
    const id = document.querySelector("#login-id")?.value;
    const token = document.querySelector("#login-token")?.value ?? "";
    if (!id)
      return;
    if (!pullCurtain(true))
      return;
    const parsedId = safe(() => parseInt(id, 10)) || 0;
    const response = await callAPI("login", {
      user: parsedId,
      userToken: token
    }, false);
    pullCurtain(false);
    if (response.status == 200) {
      save("login", {
        id: parsedId,
        token
      });
      authorize(response.data);
    }
    return false;
  }
  function updateSettingsFlicker() {
    genericFlickerUpdate(
      "#settings-additional",
      "#settings-flicker",
      (contents) => {
        if (contents) {
          const parsed = safe(() => JSON.parse(contents));
          if (parsed === null) {
            return ["Not JSON", "hsla(20, 72%, 23%, .42)"];
          } else {
            return ["JSON", "hsla(100, 72%, 23%, .42)"];
          }
        } else {
          return ["Empty", "hsla(0, 0%, 60%, .42)"];
        }
      }
    );
  }
  async function saveSettings() {
    const newPassword = document.querySelector("#settings-password")?.value.trim() || null;
    const tgToken = document.querySelector("#settings-tg-token")?.value || null;
    const additionals = document.querySelector("#settings-additional")?.value ?? "";
    pullCurtain(true);
    await callAPI("saveSettings", {
      newUserToken: newPassword,
      newTgToken: tgToken,
      additionalData: additionals
    }, true);
    pullCurtain(false);
    if (newPassword)
      signOut();
  }
  function signOut() {
    save("login", null);
    switchTabContent("state", "login");
  }
})();
//# sourceMappingURL=index.js.map
