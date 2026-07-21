const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;

class TorApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._busy = false;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

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
            15,
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

        this.torSwitch = new PopupMenu.PopupSwitchMenuItem(
            "Tor Network",
            false
        );

        this.proxySwitch = new PopupMenu.PopupSwitchMenuItem(
            "System-Wide Proxy",
            false
        );

        this.menu.addMenuItem(this.torSwitch);
        this.menu.addMenuItem(this.proxySwitch);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.statusTitle = new PopupMenu.PopupMenuItem(
            "Status : Checking...",
            { reactive: false }
        );

        this.proxyStatus = new PopupMenu.PopupMenuItem(
            "Proxy : Disabled",
            { reactive: false }
        );

        this.menu.addMenuItem(this.statusTitle);
        this.menu.addMenuItem(this.proxyStatus);

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.newIdentityButton = new PopupMenu.PopupIconMenuItem(
            _("New Identity"), "view-refresh-symbolic", St.IconType.SYMBOLIC);

        this.exitInfo = new PopupMenu.PopupMenuItem(
            "Exit : Checking...",
            { reactive: false }
        );

        this.menu.addMenuItem(this.newIdentityButton);
        this.menu.addMenuItem(this.exitInfo);


        this.newIdentityButton.connect(
            "activate",
            () => {
                this.newIdentity();
            }
        );

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

            this.statusTitle.label.text =
                running
                    ? "Status : 🟢 Tor Connected"
                    : "Status : 🔴 Tor Disconnected";
        }
    }

    isProxyEnabled() {
        return this.proxySettings.get_string("mode") === "manual";
    }

    refresh() {

        this.isRunning(running => {

            this.setState(running);

            this.statusTitle.label.text =
                running
                    ? "Status : 🟢 Tor Connected"
                    : "Status : 🔴 Tor Disconnected";

        });

        const proxyEnabled = this.isProxyEnabled();

        this.proxySwitch.setToggleState(proxyEnabled);


        if (proxyEnabled) {

            const host = this.socksSettings.get_string("host");
            const port = this.socksSettings.get_int("port");

            this.proxyStatus.label.text =
                `Proxy : ${host}:${port}`;

        } else {

            this.proxyStatus.label.text =
                "Proxy : Disabled";
        }
    }

    enableProxy() {

        this.proxySettings.set_string(
            "mode",
            "manual"
        );

        this.socksSettings.set_string(
            "host",
            "127.0.0.1"
        );

        this.socksSettings.set_int(
            "port",
            9050
        );
    }

    disableProxy() {
        this.proxySettings.set_string(
            "mode",
            "none"
        );
    }

    toggleTor(enable) {

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
                }

                this.refresh();
                this.updateExitInfo();
            }
        );
    }

    newIdentity() {

        const cmd =
            "bash -c \"printf 'AUTHENTICATE \\\"password\\\"\\r\\nSIGNAL NEWNYM\\r\\n' | nc 127.0.0.1 9051\"";

        Util.spawnCommandLineAsyncIO(
            cmd,
            (stdout, stderr, exitCode) => {

                if (exitCode !== 0) {

                    global.logError(
                        "NEWNYM failed: " + stderr
                    );

                    this.exitInfo.label.text =
                        "Exit : Identity change failed";

                    return;
                }

                this.exitInfo.label.text =
                    "Exit : Changing...";
            }
        );
        this.updateExitInfo();
    }

    updateExitInfo() {

        if (!this.exitInfo)
            return;

        const cmd =
            "curl --max-time 15 --silent --fail --proxy socks5h://127.0.0.1:9050 https://check.torproject.org/api/ip";

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

                    this.exitInfo.label.text = "Exit : Waiting...";
                    return;
                }

                try {

                    const data =
                        JSON.parse(stdout);

                    const ip =
                        data.IP || "Unknown";

                    this.exitInfo.label.text =
                        `Exit IP : (${ip})`;

                } catch(e) {

                    global.logError(
                        "Exit parse error: " + e
                    );

                    this.exitInfo.label.text =
                        "Exit : Unknown";
                }
            }
        );
    }

    on_applet_removed_from_panel() {

        if (this._refreshTimer) {
            GLib.Source.remove(this._refreshTimer);
            this._refreshTimer = 0;
        }
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
