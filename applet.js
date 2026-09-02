const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Settings = imports.ui.settings;
const ModalDialog = imports.ui.modalDialog;

const ICONS = {
    TOR_ON: "nm-vpn-standalone-lock-symbolic",
    TOR_OFF: "screensaver-unlock-symbolic",
    ERROR: "dialog-error-symbolic",
    WARNING: "dialog-warning-symbolic",
    PROXY_ON: "network-transmit-receive-symbolic",
    PROXY_OFF: "network-error-symbolic",
    COUNTRY_LOC: "mark-location-symbolic",
    CITY_LOC: "find-location-symbolic",
    IP: "xsi-network-server-symbolic",
    NEW_IDENTITY: "view-refresh-symbolic",
    TEST_CONNECTION: "network-workgroup-symbolic",
    TEST_STATUS: "xsi-network-wireless-hotspot-symbolic",
    PREFS: "emblem-system-symbolic"
};

class TorApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._busy = false;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.settings = new Settings.AppletSettings(
            this,
            metadata.uuid,
            instanceId
        );

        [
            ["showHeader", "showHeader"],
            ["showPrefs", "showPrefs"],
            ["showTest", "showTest"],
            ["showNewIdentity", "showNewIdentity"],
            ["showCountry", "showCountry"],
            ["showCity", "showCity"],
            ["showIP", "showIP"],
        ].forEach(([key, property]) => {
            this.settings.bind(key, property, this.updateMenuVisibility.bind(this));
        });

        [
            ["mask-octet-1", "maskOctet1"],
            ["mask-octet-2", "maskOctet2"],
            ["mask-octet-3", "maskOctet3"],
            ["mask-octet-4", "maskOctet4"],
        ].forEach(([key, property]) => {
            this.settings.bind(key, property, this.updateExitInfo.bind(this));
        });

        [
            ["tor-host", "torHost"],
            ["socks-port", "socksPort"],
            ["control-port", "controlPort"],
            ["auto-proxy", "autoProxy"],
            ["tor-control-password", "controlPassword"],
            ["auth-method", "authMethod"]
        ].forEach(([key, property]) => {
            this.settings.bind(key, property);
        });

        this.menu = new Applet.AppletPopupMenu(this, orientation);

        const menuWidth = 360;

        this.menu.box.set_style(`width: ${menuWidth}px;`);
        this.menu.actor.set_style(`width: ${menuWidth}px;`);
        
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.proxySettings = new Gio.Settings({
            schema: "org.gnome.system.proxy"
        });

        this.socksSettings = new Gio.Settings({
            schema: "org.gnome.system.proxy.socks"
        });

        this.buildMenu();

        this.refresh();

        this.updateRefreshTimer();
    }

    updateMenuVisibility() {
        if (this._header)
            this._header.visible = this.showHeader;

        this.exitCountry.actor.visible = this.showCountry;
        this.exitCity.actor.visible = this.showCity;
        this.exitIP.actor.visible = this.showIP;

        this.newIdentityBtn.actor.visible = this.showNewIdentity;
        this.testConnectionBtn.actor.visible = this.showTest;
        this.testStatus.actor.visible = this.showTest;

        if (this.settingsBtn)
            this.settingsBtn.actor.visible = this.showPrefs;
    }

    updateRefreshTimer() {
        if (this._refreshTimer) {
            GLib.Source.remove(this._refreshTimer);
        }

        const interval = Math.max(
            5,
            Number(this.refreshInterval) || 15
        );

        this._refreshTimer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    on_applet_clicked() {
        if (this.menu.isOpen) {
            this.menu.close(true);
            return;
        }

        this.menu.open(true);

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (this.menu.isOpen)
                this._refreshMenuLayout();

            return GLib.SOURCE_REMOVE;
        });
    }

    buildMenu() {
        this._header = new St.Label({
            text: "- Tor Control -",
            x_align: Clutter.ActorAlign.CENTER,
            style: "font-size:16pt; color: white; padding:6px 12px;"
        });

        this.menu.box.add_child(this._header);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.torStatus = this.addStatusItem(
            "Tor Status : Checking...",
            ICONS.TOR_OFF
        );

        this.proxyStatus = this.addStatusItem(
            "System Proxy : Disabled",
            ICONS.PROXY_OFF
        );

        this.exitCountry = this.addStatusItem(
            "Exit Country : Checking...",
            ICONS.COUNTRY_LOC
        );

        this.setMenuItemFullWidth(this.exitCountry);

        this.exitCity = this.addStatusItem(
            "Exit City : Checking...",
            ICONS.CITY_LOC
        );

        this.setMenuItemFullWidth(this.exitCity);

        this.exitIP = this.addStatusItem(
            "Exit IP Address : Checking...",
            ICONS.IP
        );

        this.setMenuItemFullWidth(this.exitIP);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.torSwitch = new PopupMenu.PopupSwitchMenuItem(
            "Tor Network",
            false
        );

        this.menu.addMenuItem(this.torSwitch);

        this.proxySwitch = new PopupMenu.PopupSwitchMenuItem(
            "System Proxy",
            false
        );

        this.menu.addMenuItem(this.proxySwitch);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.newIdentityBtn = new PopupMenu.PopupIconMenuItem(
            _("New Identity"), ICONS.NEW_IDENTITY, St.IconType.SYMBOLIC);

        this.menu.addMenuItem(this.newIdentityBtn);

        this.testConnectionBtn = new PopupMenu.PopupIconMenuItem(
            _("Test Tor Connection"), ICONS.TEST_CONNECTION, St.IconType.SYMBOLIC);

        this.menu.addMenuItem(this.testConnectionBtn);

        this.testStatus = new PopupMenu.PopupIconMenuItem(
            _("Test : Not Run"), ICONS.TEST_STATUS, St.IconType.SYMBOLIC);

        this.testStatus.label.set_style("color: white;");
        this.testStatus._icon.set_style("color: white;");
        this.testStatus.setSensitive(false);
        this.menu.addMenuItem(this.testStatus);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.settingsBtn = new PopupMenu.PopupIconMenuItem(
            _("Preferences"), ICONS.PREFS, St.IconType.SYMBOLIC);

        this.menu.addMenuItem(this.settingsBtn);

        this.torSwitch.connect(
            "toggled",
            (item, state) => {
                this.toggleTor(state);
            }
        );

        this.proxySwitch.connect(
            "toggled",
            (item, state) => {

                if (state)
                    this.enableProxy();
                else
                    this.disableProxy();

                this.refresh();
            }
        );

        this.newIdentityBtn.connect(
            "activate",
            () => {
                this.newIdentity();
            }
        );

        this.testConnectionBtn.connect(
            "activate",
            () => {
                this.testTorConnection();

                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    if (!this.menu.isOpen)
                        this.menu.open(true);

                    return GLib.SOURCE_REMOVE;
                });
            }
        );

        this.settingsBtn.connect(
            "activate",
            () => {
                this.openSettings();
            }
        );

        this.updateMenuVisibility();
    }

    addStatusItem(text, icon) {
        const item = new PopupMenu.PopupIconMenuItem(
            text,
            icon,
            St.IconType.SYMBOLIC
        );

        item.label.set_style("color: white;");
        item._icon.set_style("color: white;");
        item.setSensitive(false);

        this.menu.addMenuItem(item);

        return item;
    }

    setMenuItemFullWidth(item) {
        const actor = item.actor;

        actor.set_x_expand(true);
        actor.set_x_align(Clutter.ActorAlign.FILL);

        if (item._icon) {
            item._icon.set_x_expand(false);
        }

        if (item.label) {
            item.label.set_x_expand(true);
            item.label.set_x_align(Clutter.ActorAlign.START);
            item.label.set_width(-1);
        }

        item.actor.queue_relayout();

        const children = actor.get_children();

        for (const child of children) {
            child.set_x_expand(true);

            if (child === item._icon)
                child.set_x_expand(false);
        }

        actor.queue_relayout();
    }

    _refreshMenuLayout() {
        this.menu.box.queue_relayout();
        this.menu.actor.queue_relayout();

        for (const child of this.menu.box.get_children()) {
            child.set_x_expand(true);
            //child.set_x_align(Clutter.ActorAlign.FILL);
            child.queue_relayout();

            const delegate = child._delegate;

            if (!delegate)
                continue;

            if (delegate.actor) {
                delegate.actor.set_x_expand(true);
                delegate.actor.set_x_align(Clutter.ActorAlign.FILL);
                delegate.actor.queue_relayout();
            }

            if (delegate.label) {
                delegate.label.set_x_expand(true);
                delegate.label.set_x_align(Clutter.ActorAlign.START);
                delegate.label.queue_relayout();
            }
        }
    }

    validatePort(value, name) {
        const port = Number(value);

        if (!Number.isInteger(port) || port < 1 || port > 65535)
            throw new Error(`${name} must be a valid port (1-65535).`);

        return port;
    }

    validateHost(value, name) {
        if (typeof value !== "string")
            throw new Error(`${name} must be a string.`);

        const host = value.trim();

        if (!host)
            throw new Error(`${name} cannot be empty.`);

        // Keep this deliberately conservative.
        // Accepts hostnames, IPv4, and bracketed IPv6.
        if (
            host.length > 253 ||
            /[\s"'`;$&|<>\\]/.test(host)
        ) {
            throw new Error(`${name} contains invalid characters.`);
        }

        return host;
    }

    validateControlPassword(value) {
        if (value == null)
            return "";

        const password = String(value);

        // Tor's quoted AUTHENTICATE form needs escaping.
        if (/[\r\n]/.test(password))
            throw new Error("Tor control password cannot contain newlines.");

        return password;
    }

    validateSettings() {
        const host = this.validateHost(
            this.torHost,
            "Tor host"
        );

        const socksPort = this.validatePort(
            this.socksPort,
            "SOCKS port"
        );

        const controlPort = this.validatePort(
            this.controlPort,
            "Control port"
        );

        const password = this.validateControlPassword(
            this.controlPassword
        );

        return {
            host,
            socksPort,
            controlPort,
            password
        };
    }


    setBootstrapProgress(progress) {
        this.exitCountry.label.text =
            "Exit Country : Bootstrapping Tor";

        this.exitCity.label.text =
            `Exit City : ${progress}%`;

        this.exitIP.label.text =
            "Exit IP Address : Loading...";

        this._refreshMenuLayout();
    }

    pollBootstrap() {
        let config;

        try {
            config = this.validateSettings();
        } catch (e) {
            global.logError(`Tor settings error: ${e.message}`);

            this.exitCountry.label.text =
                "Exit Country : Invalid Settings";

            this.exitCity.label.text =
                "Exit City : Invalid Settings";

            this.exitIP.label.text =
                "Exit IP Address : Invalid Settings";

            return;
        }

        const client = new Gio.SocketClient();

        const address = Gio.NetworkAddress.new(
            this.host,
            this.controlPort
        );

        client.connect_async(address, null, (client, result) => {

            try {

                const connection =
                    client.connect_finish(result);

                const output =
                    connection.get_output_stream();

                const input =
                    new Gio.DataInputStream({
                        base_stream:
                            connection.get_input_stream()
                    });

                this.sendCommand(output, "PROTOCOLINFO 1");

                this.readResponse(input, lines => {

                    const info =
                        this.parseProtocolInfo(lines);

                    this.authenticateBootstrap(
                        info,
                        output,
                        input,
                        connection
                    );

                });

            } catch (e) {
                global.logError(e);
            }
        });
    }

    authenticateBootstrap(info, output, input, connection) {
        this.authenticateControl(
            info,
            output,
            input,
            connection,
            () => this.finishBootstrapAuthentication(
                output,
                input,
                connection
            )
        );
    }

    finishBootstrapAuthentication(output, input, connection) {
        this.readResponse(input, lines => {

            if (!lines.some(l => l === "250 OK")) {

                connection.close(null);

                return;

            }

            this.sendCommand(
                output,
                "GETINFO status/bootstrap-phase"
            );

            this.readResponse(input, lines => {

                connection.close(null);

                const reply =
                    lines.join("\n");

                const match =
                    reply.match(/PROGRESS=(\d+)/);

                if (!match)
                    return;

                const progress =
                    Number(match[1]);

                this.setBootstrapProgress(progress);

                if (progress >= 100) {

                    this.updateExitInfo();

                    return;

                }

                GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    1,
                    () => {

                        this.pollBootstrap();

                        return GLib.SOURCE_REMOVE;
                    }
                );
            });
        });
    }

    authenticateControl(info, output, input, connection, onSuccess) {

        switch (this.authMethod) {

            case "password":
                this.authenticatePassword(
                    info,
                    output,
                    input,
                    onSuccess
                );
                break;

            case "cookie":
                this.authenticateCookie(
                    info,
                    output,
                    onSuccess
                );
                break;

            case "safecookie":
                this.authenticateSafeCookie(
                    info,
                    output,
                    input,
                    connection,
                    onSuccess
                );
                break;

            default:
                this.authenticateAuto(
                    info,
                    output,
                    input,
                    connection,
                    onSuccess
                );
        }
    }

    openSettings() {
        Util.spawnCommandLine(
            `xlet-settings applet ${this.metadata.uuid}`
        );
    }

    isRunning(callback) {
        Util.spawnCommandLineAsyncIO(
            "systemctl is-active tor",
            (stdout, stderr, exitCode) => {
                callback(exitCode === 0);
            }
        );
    }

    torInstalled(callback) {
        const torPath = GLib.find_program_in_path("tor");
        callback(torPath !== null);
    }

    setState(running) {
        this.set_applet_icon_path(
            `${this.metadata.path}/tor_${running ? "on" : "off"}.png`
        );

        this.set_applet_tooltip(
            running
                ? "Tor : Enabled"
                : "Tor : Disabled"
        );

        if (this.torSwitch)
            this.torSwitch.setToggleState(running);

        if (this.torStatus) {

            if (running) {

                this.torStatus.label.text =
                    "Tor Status : Enabled";

                this.torStatus.setIconName(ICONS.TOR_ON);

            } else {

                this.torStatus.label.text =
                    "Tor Status : Disabled";

                this.torStatus.setIconName(ICONS.TOR_OFF);
            }
        }
    }

    isProxyEnabled() {
        return this.proxySettings.get_string("mode") === "manual";
    }

    refresh() {
        this.torInstalled(installed => {

            if (!installed) {

                this.set_applet_icon_path(
                    `${this.metadata.path}/tor_off.png`
                );

                this.set_applet_tooltip(
                    "Tor : Not Installed"
                );

                this.torStatus.label.text =
                    "Tor Status : Not Installed";

                this.torStatus.setIconName(ICONS.ERROR);

                this.torSwitch.setToggleState(false);
                this.torSwitch.setSensitive(false);

                this.proxyStatus.label.text =
                    "System Proxy : Tor unavailable";

                this.proxyStatus.setIconName(ICONS.WARNING);

                return;
            }

            this.torSwitch.setSensitive(true);

            this.isRunning(running => {

                this.setState(running);

                if (running)
                    this.updateExitInfo();
                else {
                    this.exitCountry.label.text = "Exit Country : Unavailable";
                    this.exitCity.label.text = "Exit City : Unavailable";
                    this.exitIP.label.text = "Exit IP Address : Unavailable";
                }

            });

        });

        const proxyEnabled = this.isProxyEnabled();

        this.proxySwitch.setToggleState(proxyEnabled);

        if (proxyEnabled) {

            const host = this.socksSettings.get_string("host");
            const port = this.socksSettings.get_int("port");

            this.proxyStatus.label.text =
                `System Proxy : ${host}:${port}`;

            this.proxyStatus.setIconName(ICONS.PROXY_ON);

        } else {

            this.proxyStatus.label.text =
                "System Proxy : Disabled";

            this.proxyStatus.setIconName(ICONS.PROXY_OFF);
        }
    }

    enableProxy() {
        let config;

        try {
            config = this.validateSettings();
        } catch (e) {
            global.logError(`Tor settings error: ${e.message}`);
            return false;
        }

        this.proxySettings.set_string(
            "mode",
            "manual"
        );

        this.socksSettings.set_string(
            "host",
            this.host
        );

        this.socksSettings.set_int(
            "port",
            this.socksPort
        );

        return true;
    }

    disableProxy() {
        this.proxySettings.set_string(
            "mode",
            "none"
        );
    }

    toggleTor(enable) {
        this._lastTestIP = null;
        this.testStatus.label.text = "Test : Not Tested";

        if (GLib.find_program_in_path("tor") === null) {

            global.logError(
                "Tor is not installed"
            );

            return;
        }

        if (this._busy)
            return;

        this._busy = true;

        const cmd = enable
            ? "pkexec systemctl start tor"
            : "pkexec systemctl stop tor";

        Util.spawnCommandLineAsyncIO(
            cmd,
            (stdout, stderr, exitCode) => {

                this._busy = false;

                if (exitCode !== 0) {
                    global.logError(stderr);
                    return;
                }

                if (this.autoProxy) {
                    if (enable)
                        this.enableProxy();
                    else
                        this.disableProxy();
                }

                this.setBootstrapProgress(0);

                GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    1,
                    () => {

                        this.pollBootstrap();

                        return GLib.SOURCE_REMOVE;
                    }
                );

                this.refresh();
            }
        );
    }

    maskIPAddress(ip) {
        const parts = ip.split(".");

        if (parts.length !== 4)
            return ip;

        if (this.maskOctet1) parts[0] = "xxx";
        if (this.maskOctet2) parts[1] = "xxx";
        if (this.maskOctet3) parts[2] = "xxx";
        if (this.maskOctet4) parts[3] = "xxx";

        return parts.join(".");
    }

    newIdentity() {
        global.log("Initiate New Identity");
        this._lastTestIP = null;
        this.testStatus.label.text = "Test : Not Tested";

        let config;

        try {
            config = this.validateSettings();
        } catch (e) {
            global.logError(`Tor settings error: ${e.message}`);
            this.testStatus.label.text =
                "Test : Invalid Settings";
            return;
        }

        const client = new Gio.SocketClient();

        const address = Gio.NetworkAddress.new(
            this.host, this.controlPort);

        client.connect_async(
            address,
            null,
            (client, result) => {

                try {

                    const connection =
                        client.connect_finish(result);

                    const output =
                        connection.get_output_stream();

                    const input =
                        new Gio.DataInputStream({
                            base_stream:
                                connection.get_input_stream()
                        });

                    this.sendCommand(output, "PROTOCOLINFO 1");

                    this.readResponse(input, lines => {
                        const info = this.parseProtocolInfo(lines);

                        try {
                            this.authenticate(info, output, input, connection);
                        } catch (e) {
                            global.logError(e);
                            connection.close(null);
                        }
                    });

                } catch (e) {

                    global.logError(e);

                    this.exitCountry.label.text =
                        "Exit : Unable to Connect";
                    this.exitCity.label.text =
                        "Exit : Unable to Connect";
                    this.exitIP.label.text =
                        "Exit : Unable to Connect";
                }
            }
        );
    }

    sendCommand(output, command) {
        try {

            output.write_all(command + "\r\n", null);
            output.flush(null);

        } catch (e) {
            global.logError(e);
        }
    }

    readResponse(input, callback) {

        let lines = [];

        const readNext = () => {

            input.read_line_async(
                GLib.PRIORITY_DEFAULT,
                null,
                (stream, res) => {

                    try {

                        const [line] =
                            stream.read_line_finish_utf8(res);

                        if (line === null) {
                            callback(lines);
                            return;
                        }

                        const clean =
                            line.replace(/\r$/, "");

                        lines.push(clean);

                        if (
                            clean === "250 OK" ||
                            clean.startsWith("5")
                        ) {
                            callback(lines);
                            return;
                        }

                        readNext();

                    } catch (e) {

                        global.logError(e);

                    }
                }
            );

        };

        readNext();
    }

    parseProtocolInfo(lines) {
        const reply = lines.join("\n");

        return {

            methods:
                reply.match(/METHODS=([^ ]+)/)?.[1]
                    ?.split(",") ?? [],

            cookieFile:
                reply.match(/COOKIEFILE="([^"]+)"/)?.[1] ?? null

        };
    }

    authenticate(info, output, input, connection) {
        this.authenticateControl(
            info,
            output,
            input,
            connection,
            () => this.finishAuthentication(output, input, connection)
        );
    }

    authenticatePassword(info, output, input, onSuccess) {

        if (!info.methods.includes("HASHEDPASSWORD"))
            throw new Error("Password authentication not supported.");

        const password = this.escapeTorString(this.controlPassword);

        this.sendCommand(
            output,
            `AUTHENTICATE "${password}"`
        );

        this.readResponse(input, lines => {

            if (lines.includes("250 OK"))
                onSuccess();
            else
                global.logError("AUTHENTICATE failed");

        });
    }

    escapeTorString(value) {
        return String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

    authenticateSafeCookie(info, output, input, connection, onSuccess) {
        if (!info.methods.includes("SAFECOOKIE"))
            throw new Error("SAFECOOKIE authentication not supported.");

        if (!info.cookieFile)
            throw new Error("Tor did not provide a COOKIEFILE.");

        const file = Gio.File.new_for_path(info.cookieFile);

        let cookie;

        try {
            [, cookie] = file.load_contents(null);
        } catch (e) {
            throw new Error(
                `Failed to read Tor authentication cookie: ${info.cookieFile}`
            );
        }

        const clientNonce = this.randomBytes(32);

        this.sendCommand(
            output,
            `AUTHCHALLENGE SAFECOOKIE ${this.bytesToHex(clientNonce)}`
        );

        this.readResponse(input, lines => {

            const reply = lines.join("\n");

            const serverHash =
                reply.match(/SERVERHASH=([0-9A-F]+)/)?.[1];

            const serverNonce =
                reply.match(/SERVERNONCE=([0-9A-F]+)/)?.[1];

            if (!serverHash || !serverNonce) {
                connection.close(null);
                throw new Error("Invalid SAFECOOKIE response.");
            }

            this.computeSafeCookieClientHash(
                cookie,
                clientNonce,
                this.hexToBytes(serverNonce),
                clientHash => {

                    if (!clientHash) {
                        connection.close(null);
                        return;
                    }

                    this.sendCommand(output, `AUTHENTICATE ${clientHash}`);

                    this.readResponse(input, lines => {
                        if (!lines.some(l => l === "250 OK")) {
                            connection.close(null);
                            global.logError("SAFECOOKIE authentication failed");
                            return;
                        }

                        onSuccess();
                    });

                }
            );
        });
    }

    computeSafeCookieClientHash(
        cookie,
        clientNonce,
        serverNonce,
        callback
    ) {
        try {
            const key = new TextEncoder().encode(
                "Tor safe cookie authentication controller-to-server hash"
            );

            const message = new Uint8Array(
                cookie.length +
                clientNonce.length +
                serverNonce.length
            );

            let offset = 0;

            message.set(cookie, offset);
            offset += cookie.length;

            message.set(clientNonce, offset);
            offset += clientNonce.length;

            message.set(serverNonce, offset);

            const hash = GLib.compute_hmac_for_bytes(
                GLib.ChecksumType.SHA256,
                key,
                message
            );

            callback(hash.toUpperCase());

        } catch (e) {
            global.logError(
                `SAFECOOKIE HMAC failed: ${e.message}`
            );

            callback(null);
        }
    }

    authenticateCookie(info, output, onSuccess) {
        if (!info.methods.includes("COOKIE"))
            throw new Error("Cookie authentication not supported.");

        const file = Gio.File.new_for_path(info.cookieFile);

        try {

            const [, bytes] = file.load_contents(null);

            const hex = Array.from(bytes)
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");

            this.sendCommand(output, `AUTHENTICATE ${hex}`);

            this.readResponse(input, lines => {
                if (lines.some(line => line === "250 OK")) {
                    onSuccess();
                } else {
                    global.logError("COOKIE authentication failed");
                }
            });

        } catch (e) {

            global.logError(e);

            throw new Error(
                `Failed to read Tor authentication cookie: ${info.cookieFile}`
            );
        }
    }

    authenticateAuto(info, output, input, connection, onSuccess) {
        if (
            info.methods.includes("HASHEDPASSWORD") &&
            this.controlPassword
        ) {
            this.authenticatePassword(
                info,
                output,
                input,
                onSuccess
            );
            return;
        }

        if (info.methods.includes("SAFECOOKIE")) {
            this.authenticateSafeCookie(
                info,
                output,
                input,
                connection,
                onSuccess
            );
            return;
        }

        if (info.methods.includes("COOKIE")) {
            this.authenticateCookie(
                info,
                output,
                onSuccess
            );
            return;
        }

        throw new Error("No supported authentication method.");
    }

    finishAuthentication(output, input, connection) {
        this.readResponse(input, lines => {

            if (!lines.some(l => l === "250 OK")) {

                connection.close(null);

                return;
            }

            this.sendCommand(
                output,
                "SIGNAL NEWNYM"
            );

            this.readResponse(input, () => {

                this.sendCommand(output, "QUIT");

                connection.close(null);

                this.setBootstrapProgress(0);

                GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    1,
                    () => {
                        this.pollBootstrap();
                        return GLib.SOURCE_REMOVE;
                    }
                );
            });
        });
    }

    randomBytes(length) {
        const bytes = new Uint8Array(length);

        for (let i = 0; i < length; i++)
            bytes[i] = GLib.random_int_range(0, 256);

        return bytes;
    }

    bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);

        for (let i = 0; i < bytes.length; i++)
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);

        return bytes;
    }

    updateExitInfo() {
        if (!this.exitIP)
            return;

        const cmd =
           `curl --max-time 15 --silent --fail --proxy socks5h://${this.torHost}:${this.socksPort} ip-api.com/json/`;

        Util.spawnCommandLineAsyncIO(
            cmd,
            (stdout, stderr, exitCode) => {

                if (exitCode !== 0 || !stdout) {

                    global.logError(
                        `Exit lookup failed (${exitCode}): ${stderr}`
                    );

                    this.exitCountry.label.text =
                        "Exit Country : Waiting...";

                    this.exitCity.label.text =
                        "Exit City : Waiting...";

                    this.exitIP.label.text =
                        "Exit IP Address : Waiting...";

                    return;
                }

                try {

                    const data =
                        JSON.parse(stdout);

                    const country = 
                        data.country || "Unknown";

                    const city =
                        data.city || "Unknown";

                    const ip =
                        data.query || "Unknown";

                    this.exitCountry.label.text =
                        `Exit Country : ${country}`;
                        
                    this.exitCity.label.text =
                        `Exit City : ${city}`;

                    this.exitIP.label.text =
                        `Exit IP Address : ${this.maskIPAddress(ip)}`;

                    if (
                        this._lastTestIP !== null &&
                        this._lastTestIP !== ip
                    ) {
                        this.testStatus.label.text = "Test : Not Tested";
                    }

                    this._refreshMenuLayout();

                } catch(e) {

                    global.logError(
                        "Exit parse error: " + e
                    );

                    this.exitCountry.label.text =
                        `Exit Country : Unknown`;

                    this.exitCity.label.text =
                        `Exit City : Unknown`;

                    this.exitIP.label.text =
                        `Exit IP Address : Unknown`;
                }
            }
        );
    }

    testTorConnection() {
        this._refreshMenuLayout();
        
        this._lastTestIP = null;
        this.testStatus.label.text = "Test : Testing...";

        const cmd =
            `curl --max-time 15 --silent --fail \
            --proxy socks5h://${this.torHost}:${this.socksPort} \
            https://check.torproject.org/api/ip`;

        Util.spawnCommandLineAsyncIO(
            cmd,
            (stdout, stderr, exitCode) => {

                if (exitCode !== 0 || !stdout) {
                    global.logError(
                        `Tor test failed (${exitCode}): ${stderr}`
                    );

                    this.testStatus.label.text =
                        "Test : Unable to test connection";

                    this._refreshMenuLayout();
                    return;
                }

                try {
                    const data = JSON.parse(stdout);

                    if (data.IsTor) {
                        this._lastTestIP = data.IP;

                        this.testStatus.label.text =
                            `Test : Tor OK (${this.maskIPAddress(data.IP)})`;
                    } else {
                        this._lastTestIP = null;

                        this.testStatus.label.text =
                            "Test : Traffic is NOT using Tor";
                    }

                } catch (e) {
                    global.logError(e);

                    this.testStatus.label.text =
                        "Test : Invalid response";
                }

                this._refreshMenuLayout();
            }
        );
    }

    on_applet_removed_from_panel() {
        if (this._refreshTimer)
            GLib.Source.remove(this._refreshTimer);

        this.settings.finalize();

        this.proxySettings = null;
        this.socksSettings = null;
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new TorApplet(
        metadata,
        orientation,
        panelHeight,
        instanceId
    );
}
