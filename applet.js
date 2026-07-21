const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

class TorApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);

        this.menuManager.addMenu(this.menu);
        this.metadata = metadata;

        this.proxySettings = new Gio.Settings({
            schema: "org.gnome.system.proxy"
        });

        this.socksSettings = new Gio.Settings({
            schema: "org.gnome.system.proxy.socks"
        });

        this.refresh();

        this._refreshTimer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            5,
            () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    on_applet_clicked() {
        if (this._busy)
            return;

        this.toggleTor();
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
            `${this.metadata.path}/tor_${running ? "connected" : "disconnected"}.png`
        );

        this.set_applet_tooltip(
            running ? "Tor: Enabled" : "Tor: Disabled"
        );
    }

    refresh() {
        this.isRunning(running => this.setState(running));
    }

    enableProxy() {
        this.proxySettings.set_string("mode", "manual");
        this.socksSettings.set_string("host", "127.0.0.1");
        this.socksSettings.set_int("port", 9050);
    }

    disableProxy() {
        this.proxySettings.set_string("mode", "none");
    }

    toggleTor() {
        this._busy = true;

        this.isRunning((running) => {
            const cmd = running
                ? "pkexec systemctl stop tor"
                : "pkexec systemctl start tor";

            Util.spawnCommandLineAsyncIO(
                cmd,
                (stdout, stderr, exitCode) => {
                    this._busy = false;

                    if (exitCode !== 0) {
                        global.logError(stderr);
                        this.refresh();
                        return;
                    }

                    if (running) {
                        this.disableProxy();
                    } else {
                        this.enableProxy();
                    }

                    this.refresh();
                }
            );
        });
    }

    on_applet_removed_from_panel() {
        if (this._refreshTimer) {
            GLib.Source.remove(this._refreshTimer);
            this._refreshTimer = 0;
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new TorApplet(metadata, orientation, panelHeight, instanceId);
}

