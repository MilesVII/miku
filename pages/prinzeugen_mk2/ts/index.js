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
    return {
      status: response.status,
      headers: response.headers,
      data: payload
    };
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
    const [text, color = "hsla(0, 0%, 60%, .42)"] = cb(contents);
    flicker.textContent = text;
    flicker.style.backgroundColor = color;
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
      if (field)
        field.value = data[key];
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
      label: "Tags"
    }),
    fieldSchema("whitelist", "list", {
      label: "Whitelist",
      placeholder: "sort:id:asc and id:>lastseen are added autmoatically"
    }),
    fieldSchema("blacklist", "list", {
      label: "Blacklist"
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

  // src/grabbing.ts
  async function downloadGrabbers() {
    const grabbers = await callAPI("getGrabbers", {}, true);
    if (grabbers.status == 200)
      return grabbers.data;
    else
      return null;
  }
  function showGrabbers(grabs) {
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
      console.error(response);
    } else
      newRows.push(response.data);
    updateCurtainMessage(`Updating state`);
    const updateGrabbers = await downloadGrabbers();
    pullCurtain(false);
    if (updateGrabbers)
      showGrabbers(updateGrabbers);
  }
  async function saveGrabbers() {
    const list = document.querySelector("#grabbers-list");
    const grabs = Array.from(list?.children ?? []).map((el) => {
      const container = el;
      console.log(container);
      console.log(container?.dataset.grabberForm);
      return Grabbers[container?.dataset.grabberForm].read(container);
    });
    pullCurtain(true);
    const response = await callAPI("setGrabbers", {
      grabbers: grabs
    });
    const updateGrabbers = response.status === 200 ? await downloadGrabbers() : null;
    pullCurtain(false);
    if (updateGrabbers)
      showGrabbers(updateGrabbers);
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
    proto.dataset.grabberForm = type;
    proto.appendChild(renderForm(meta.form));
    const buttons = fromTemplate("generic-grabber-buttons")?.firstElementChild;
    if (!buttons)
      return null;
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

  // src/main.ts
  main();
  async function main() {
    updateTabListeners();
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
    document.querySelector("#grabbers-save")?.addEventListener("click", () => saveGrabbers());
    showGrabbers(userData.grabbers);
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
})();
//# sourceMappingURL=index.js.map
