const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Settings = imports.ui.settings;

const ICONS = {
    TOR_ON: "org.x.Warpinator-symbolic",
    TOR_OFF: "org.x.Warpinator-error-symbolic",
    ERROR: "dialog-error-symbolic",
    WARNING: "dialog-warning-symbolic",
    PROXY_ON: "network-transmit-receive-symbolic",
    PROXY_OFF: "network-error-symbolic"
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

        this.settings.bind(
            "showCountry",
            "showCountry",
            this.updateMenuVisibility.bind(this)
        );

        this.settings.bind(
            "showCity",
            "showCity",
            this.updateMenuVisibility.bind(this)
        );

        this.settings.bind(
            "showIP",
            "showIP",
            this.updateMenuVisibility.bind(this)
        );

        this.settings.bind(
            "mask-octet-1",
            "maskOctet1",
            this.updateExitInfo.bind(this)
        );

        this.settings.bind(
            "mask-octet-2",
            "maskOctet2",
            this.updateExitInfo.bind(this)
        );

        this.settings.bind(
            "mask-octet-3",
            "maskOctet3",
            this.updateExitInfo.bind(this)
        );

        this.settings.bind(
            "mask-octet-4",
            "maskOctet4",
            this.updateExitInfo.bind(this)
        );

        this.settings.bind(
            "tor-host",
            "torHost"
        );

        this.settings.bind(
            "socks-port",
            "socksPort"
        );

        this.settings.bind(
            "control-port",
            "controlPort"
        );

        this.settings.bind(
            "refresh-interval",
            "refreshInterval"
        );

        this.settings.bind(
            "auto-proxy",
            "autoProxy"
        );

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.proxySettings = new Gio.Settings({
            schema: "org.gnome.system.proxy"
        });

        this.socksSettings = new Gio.Settings({
            schema: "org.gnome.system.proxy.socks"
        });

        this.buildMenu();

        this.refresh();

        this.updateExitInfo();

        this._refreshTimer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.refreshInterval,
            () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    buildMenu() {

        this._header = new St.Label({
            text: "Tor Control",
            x_align: Clutter.ActorAlign.CENTER,
            style: "font-size:16pt; color:#888888; padding:6px 12px;"
        });

        this.menu.box.add_child(this._header);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.statusTitle = new PopupMenu.PopupIconMenuItem(
            "Tor Status : Checking...",
            ICONS.TOR_OFF,
            St.IconType.SYMBOLIC
        );

        this.statusTitle.label.x_expand = true;
        this.statusTitle.setSensitive(false);
        this.menu.addMenuItem(this.statusTitle);

        this.proxyStatus = new PopupMenu.PopupIconMenuItem(
            "System Proxy : Disabled",
            ICONS.PROXY_OFF,
            St.IconType.SYMBOLIC
        );

        this.proxyStatus.label.x_expand = true;
        this.proxyStatus.setSensitive(false);
        this.menu.addMenuItem(this.proxyStatus);

        this.exitCountry = new PopupMenu.PopupIconMenuItem(
            "Exit Country : Checking...",
            "mark-location-symbolic",
            St.IconType.SYMBOLIC
        );

        this.exitCountry.label.x_expand = true;
        this.exitCountry.setSensitive(false);
        this.menu.addMenuItem(this.exitCountry);

        this.exitCity = new PopupMenu.PopupIconMenuItem(
            "Exit City : Checking...",
            "find-location-symbolic",
            St.IconType.SYMBOLIC
        );

        this.exitCity.label.x_expand = true;
        this.exitCity.setSensitive(false);
        this.menu.addMenuItem(this.exitCity);

        this.exitIP = new PopupMenu.PopupIconMenuItem(
            "Exit IP Address : Checking...",
            "xsi-network-server-symbolic",
            St.IconType.SYMBOLIC
        );

        this.exitIP.label.x_expand = true;
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
            _("New Identity"), "view-refresh-symbolic", St.IconType.SYMBOLIC);

        this.menu.addMenuItem(this.newIdentityButton);

        this.testConnectionButton = new PopupMenu.PopupIconMenuItem(
            _("Test Tor Connection"),
            "network-workgroup-symbolic",
            St.IconType.SYMBOLIC
        );

        this.menu.addMenuItem(this.testConnectionButton);

        this.testConnectionButton.connect(
            "activate",
            () => {
                this.testTorConnection();
            }
        );

        this.testStatus = new PopupMenu.PopupIconMenuItem(
            "Test : Not Run",
            "xsi-network-wireless-hotspot-symbolic",
            St.IconType.SYMBOLIC
        );

        this.testStatus.setSensitive(false);
        this.menu.addMenuItem(this.testStatus);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.settingsButton =
            new PopupMenu.PopupIconMenuItem(
                _("Preferences"),
                "emblem-system-symbolic",
                St.IconType.SYMBOLIC
            );

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

        this.settingsButton.connect(
            "activate",
            () => {
                this.openSettings();
            }
        );

        this.updateMenuVisibility();
    }

    updateMenuVisibility() {
        this.exitCountry.actor.visible = this.showCountry;
        this.exitCity.actor.visible = this.showCity;
        this.exitIP.actor.visible = this.showIP;
    }

    openSettings() {
        Util.spawnCommandLine(
            `xlet-settings applet ${this.metadata.uuid}`
        );
    }

    on_applet_clicked() {
        this.menu.toggle();
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
                ? "Tor : Connected"
                : "Tor : Disconnected"
        );

        if (this.torSwitch)
            this.torSwitch.setToggleState(running);

        if (this.statusTitle) {

            if (running) {

                this.statusTitle.label.text =
                    "Tor Status : Connected";

                this.statusTitle.setIconName(ICONS.TOR_ON);

            } else {

                this.statusTitle.label.text =
                    "Tor Status : Disconnected";

                this.statusTitle.setIconName(ICONS.TOR_OFF);
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

                this.statusTitle.label.text =
                    "Tor Status : Not Installed";

                this.statusTitle.setIconName(ICONS.ERROR);

                this.torSwitch.setToggleState(false);
                this.torSwitch.setSensitive(false);

                this.proxyStatus.label.text =
                    "System Proxy : Tor unavailable";

                this.proxyStatus.setIconName(ICONS.WARNING);

                const currentExitIP =
                    this.exitIP.label.text.replace("Exit IP Address : ", "");

                return;
            }

            this.torSwitch.setSensitive(true);

            this.isRunning(running => {

                this.setState(running);

                this.updateExitInfo();

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

                GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    5,
                    () => {

                        this.updateExitInfo();

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

                global.log("Connect callback");

                try {

                    const connection =
                        client.connect_finish(result);

                    global.log("Connected to ControlPort");

                    const output =
                        connection.get_output_stream();

                    const input =
                        new Gio.DataInputStream({
                            base_stream:
                                connection.get_input_stream()
                        });

                    const command =
                        'AUTHENTICATE "password"\r\n' +
                        'SIGNAL NEWNYM\r\n' +
                        'QUIT\r\n';

                    output.write_all(
                        command,
                        null
                    );

                    output.flush(null);

                    global.log("Commands sent");

                    input.read_line_async(
                        GLib.PRIORITY_DEFAULT,
                        null,
                        (stream, res) => {

                            try {

                                const [line] =
                                    stream.read_line_finish_utf8(res);

                                global.log(
                                    "Tor replied: " + line
                                );

                                this.exitCountry.label.text =
                                    "Exit : Changing...";
                                this.exitCity.label.text =
                                    "Exit : Changing...";
                                this.exitIP.label.text =
                                    "Exit : Changing...";

                                GLib.timeout_add_seconds(
                                    GLib.PRIORITY_DEFAULT,
                                    5,
                                    () => {

                                        this.updateExitInfo();

                                        return GLib.SOURCE_REMOVE;
                                    }
                                );

                            } catch (e) {

                                global.logError(e);

                                this.exitCounry.label.text =
                                    "Exit : Identity Change Failed";
                                this.exitCity.label.text =
                                    "Exit : Identity Change Failed";
                                this.exitIP.label.text =
                                    "Exit : Identity Change Failed";
                            }

                            connection.close(null);

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

    updateExitInfo() {

        if (!this.exitIP)
            return;

        const cmd =
           `curl --max-time 15 --silent --fail --proxy socks5h://${this.torHost}:${this.socksPort} ip-api.com/json/`;

        Util.spawnCommandLineAsyncIO(
            cmd,
            (stdout, stderr, exitCode) => {

                if (exitCode !== 0 || !stdout) {

                    global.log(
                        `exit=${exitCode}\nstdout=${stdout}\nstderr=${stderr}`
                    );

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

                    this.menu.actor.queue_relayout();
                    this.menu.box.queue_relayout();

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

        if (this._refreshTimer) {
            GLib.Source.remove(this._refreshTimer);
        }

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
