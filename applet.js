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

        this.newIdentityButton.actor.visible = this.showNewIdentity;
        this.testConnectionButton.actor.visible = this.showTest;
        this.testStatus.actor.visible = this.showTest;

        if (this.settingsButton)
            this.settingsButton.actor.visible = this.showPrefs;
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

        this._refreshMenuLayout();
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

        this.torStatus = new PopupMenu.PopupIconMenuItem(
            "Tor Status : Checking...", ICONS.TOR_OFF, St.IconType.SYMBOLIC);

        this.torStatus.label.set_style("color: white;");
        this.torStatus._icon.set_style("color: white;");
        this.torStatus.setSensitive(false);
        this.menu.addMenuItem(this.torStatus);

        this.proxyStatus = new PopupMenu.PopupIconMenuItem(
            "System Proxy : Disabled", ICONS.PROXY_OFF, St.IconType.SYMBOLIC);

        this.proxyStatus.label.set_style("color: white;");
        this.proxyStatus._icon.set_style("color: white;");
        this.proxyStatus.setSensitive(false);
        this.menu.addMenuItem(this.proxyStatus);

        this.exitCountry = new PopupMenu.PopupIconMenuItem(
            "Exit Country : Checking...", ICONS.COUNTRY_LOC, St.IconType.SYMBOLIC);

        this.exitCountry.label.set_style("min-width: 175px; color: white;");
        this.exitCountry._icon.set_style("color: white;");
        this.exitCountry.setSensitive(false);
        this.menu.addMenuItem(this.exitCountry);

        this.exitCity = new PopupMenu.PopupIconMenuItem(
            "Exit City : Checking...", ICONS.CITY_LOC, St.IconType.SYMBOLIC);

        this.exitCity.label.set_style("min-width: 175px; color: white;");
        this.exitCity._icon.set_style("color: white;");
        this.exitCity.setSensitive(false);
        this.menu.addMenuItem(this.exitCity);

        this.exitIP = new PopupMenu.PopupIconMenuItem(
            "Exit IP Address : Checking...", ICONS.IP, St.IconType.SYMBOLIC);

        this.exitIP.label.set_style("min-width: 175px; color: white;");
        this.exitIP._icon.set_style("color: white;");
        this.exitIP.setSensitive(false);
        this.menu.addMenuItem(this.exitIP);

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

        this.newIdentityButton = new PopupMenu.PopupIconMenuItem(
            _("New Identity"), ICONS.NEW_IDENTITY, St.IconType.SYMBOLIC);

        this.menu.addMenuItem(this.newIdentityButton);

        this.testConnectionButton = new PopupMenu.PopupIconMenuItem(
            _("Test Tor Connection"), ICONS.TEST_CONNECTION, St.IconType.SYMBOLIC);

        this.menu.addMenuItem(this.testConnectionButton);

        this.testStatus = new PopupMenu.PopupIconMenuItem(
            _("Test : Not Run"), ICONS.TEST_STATUS, St.IconType.SYMBOLIC);

        this.testStatus.label.set_style("color: white;");
        this.testStatus._icon.set_style("color: white;");
        this.testStatus.setSensitive(false);
        this.menu.addMenuItem(this.testStatus);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.settingsButton = new PopupMenu.PopupIconMenuItem(
            _("Preferences"), ICONS.PREFS, St.IconType.SYMBOLIC);

        this.menu.addMenuItem(this.settingsButton);

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

        this.newIdentityButton.connect(
            "activate",
            () => {
                this.newIdentity();
            }
        );

        this.testConnectionButton.connect(
            "activate",
            () => {
                this.testTorConnection();
            }
        );

        this.settingsButton.connect(
            "activate",
            () => {
                this.openSettings();
            }
        );

        this.updateMenuVisibility();
    }

    _refreshMenuLayout() {
        const children = this.menu.box.get_children();

        for (const child of children) {
            child.queue_relayout();

            const delegate = child._delegate;

            if (delegate && delegate.actor)
                delegate.actor.queue_relayout();

            if (delegate && delegate.label)
                delegate.label.queue_relayout();
        }

        const widths = this.menu.getColumnWidths();

        this.menu.setColumnWidths(widths);

        this.menu.box.queue_relayout();
        this.menu.actor.queue_relayout();
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
        const client = new Gio.SocketClient();

        const address = Gio.NetworkAddress.new(
            this.torHost,
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
        this.proxySettings.set_string(
            "mode",
            "manual"
        );

        this.socksSettings.set_string(
            "host",
            this.torHost
        );

        this.socksSettings.set_int(
            "port",
            this.socksPort
        );
    }

    disableProxy() {
        this.proxySettings.set_string(
            "mode",
            "none"
        );
    }

    toggleTor(enable) {
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
        this.testStatus.label.text = "Test : Not Tested";

        const client = new Gio.SocketClient();

        const address = Gio.NetworkAddress.new(
            this.torHost, this.controlPort);

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

        this.sendCommand(
            output,
            `AUTHENTICATE "${this.controlPassword}"`
        );

        this.readResponse(input, lines => {

            if (lines.includes("250 OK"))
                onSuccess();
            else
                global.logError("AUTHENTICATE failed");

        });
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

                    this.sendCommand(
                        output,
                        `AUTHENTICATE ${clientHash}`
                    );

                    onSuccess();
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
        const prefix =
            "Tor safe cookie authentication controller-to-server hash";

        const encoder = new TextEncoder();
        const prefixBytes = encoder.encode(prefix);

        const message = new Uint8Array(
            prefixBytes.length +
            clientNonce.length +
            serverNonce.length
        );

        message.set(prefixBytes, 0);
        message.set(clientNonce, prefixBytes.length);
        message.set(
            serverNonce,
            prefixBytes.length + clientNonce.length
        );

        const cookieHex = this.bytesToHex(cookie);

        const [, tmpfile] = GLib.file_open_tmp("tor-safecookie-XXXXXX");

        GLib.file_set_contents(tmpfile, message);

        const cmd =
            `openssl dgst -sha256 \
             -mac HMAC \
             -macopt hexkey:${cookieHex} \
             -binary < "${tmpfile}" | xxd -p -c 256`;

        Util.spawnCommandLineAsyncIO(
            cmd,
            (stdout, stderr, exitCode) => {

                GLib.unlink(tmpfile);

                if (exitCode !== 0) {
                    global.logError(stderr);
                    callback(null);
                    return;
                }

                callback(stdout.trim().toUpperCase());
            }
        );
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

            onSuccess();

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

                    if (!this.testStatus.label.text.includes(ip))
                        this.testStatus.label.text = "Test : Not Tested";

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

                    return;
                }

                try {

                    const data = JSON.parse(stdout);

                    if (data.IsTor) {

                        this.testStatus.label.text =
                            `Test : Tor OK (${this.maskIPAddress(data.IP)})`;

                    } else {

                        this.testStatus.label.text =
                            "Test : Traffic is NOT using Tor";
                    }

                } catch (e) {

                    global.logError(e);

                    this.testStatus.label.text =
                        "Test : Invalid response";
                }
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
