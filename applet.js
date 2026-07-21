const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

class TorApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);

        this.menuManager.addMenu(this.menu);

        this.refresh();

        GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            5,
            () => {
                this.refresh();
                return true;
            }
        );
    }

    on_applet_clicked() {
        global.log("Tor applet clicked");
        this.toggleTor();
    }

    isRunning(callback) {
        Util.spawnCommandLineAsyncIO(
            "systemctl is-active tor",
            (stdout, stderr, exitCode) => {
                callback(stdout.trim() === "active");
            }
        );
    }

    refresh() {
        this.isRunning((running) => {
            if (running) {
                this.set_applet_icon_name("network-vpn-symbolic");
                this.set_applet_tooltip("Tor: Enabled");
            } else {
                this.set_applet_icon_name("network-offline-symbolic");
                this.set_applet_tooltip("Tor: Disabled");
            }
        });
    }

    toggleTor() {
        this.isRunning((running) => {
            let cmd;

            if (running) {
                cmd = `
                    pkexec systemctl stop tor &&
                    gsettings set org.gnome.system.proxy mode 'none'
                `.replace(/\s+/g, " ");
            } else {
                cmd = `
                    pkexec systemctl start tor &&
                    gsettings set org.gnome.system.proxy mode 'manual' &&
                    gsettings set org.gnome.system.proxy.socks host '127.0.0.1' &&
                    gsettings set org.gnome.system.proxy.socks port 9050
                `.replace(/\s+/g, " ");
            }

            Util.spawnCommandLineAsyncIO(
                cmd,
                (stdout, stderr, exitCode) => {
                    global.log(`exit=${exitCode}`);
                    global.log(`stdout=${stdout}`);
                    global.log(`stderr=${stderr}`);
                }
            );

            GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                1,
                () => {
                    this.refresh();
                    return GLib.SOURCE_REMOVE;
                }
            );
        });
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new TorApplet(metadata, orientation, panelHeight, instanceId);
}

