# Tor Control — Cinnamon Applet

A Cinnamon desktop applet for controlling **Tor**, managing the **GNOME system SOCKS proxy**, requesting new Tor identities, and displaying information about the current Tor exit node.

The applet communicates with the Tor Control Port and supports multiple Tor authentication methods, including password, cookie, and SafeCookie authentication.

## Features

* 🧅 Start and stop the Tor service directly from the Cinnamon panel.
* 🔄 Request a **New Identity** using Tor's `SIGNAL NEWNYM`.
* 🌐 Enable or disable the system SOCKS proxy.
* 📍 Display the current Tor exit:

  * Country
  * City
  * IP address
* 🛡️ Test whether traffic is actually passing through Tor.
* 📊 Display Tor bootstrap progress while connecting.
* 🔐 Support multiple Tor Control Port authentication methods:

  * Password
  * Cookie
  * SafeCookie
  * Automatic authentication
* 👁️ Optionally mask individual IP address octets.
* ⚙️ Configurable refresh interval and display options.
* 🖥️ Designed for the Cinnamon desktop environment.

## Requirements

The applet requires:

* Linux
* Cinnamon
* Tor
* `curl`
* `openssl`
* `xxd`
* A configured Tor Control Port
* `systemd` for starting/stopping the Tor service

The Tor service is expected to be available as:

```bash
systemctl status tor
```

### Install dependencies

On Debian/Ubuntu-based systems:

```bash
sudo apt install tor curl openssl xxd
```

On Arch Linux:

```bash
sudo pacman -S tor curl openssl xxd
```

On Fedora:

```bash
sudo dnf install tor curl openssl xxd
```

## Installation

Clone the repository:

```bash
git clone https://github.com/USERNAME/REPOSITORY.git
```

Copy the applet into your Cinnamon applets directory:

```bash
mkdir -p ~/.local/share/cinnamon/applets
cp -r REPOSITORY ~/.local/share/cinnamon/applets/
```

The directory should contain the applet metadata and source files, for example:

```text
~/.local/share/cinnamon/applets/
└── your-applet-uuid/
    ├── applet.js
    ├── metadata.json
    ├── settings-schema.json
    ├── tor_on.png
    └── tor_off.png
```

Then open:

**Cinnamon Settings → Applets**

Find **Tor Control** and add it to the panel.

## Configuration

The applet provides configuration options for the Tor connection and interface.

### Tor Connection

| Setting                | Description                              |
| ---------------------- | ---------------------------------------- |
| `tor-host`             | Tor Control/SOCKS host                   |
| `socks-port`           | SOCKS proxy port                         |
| `control-port`         | Tor Control Port                         |
| `auth-method`          | Authentication method                    |
| `tor-control-password` | Tor control password                     |
| `auto-proxy`           | Automatically configure the system proxy |
| `refreshInterval`      | Status refresh interval                  |

Typical local Tor settings are:

```text
Tor Host:       127.0.0.1
SOCKS Port:     9050
Control Port:   9051
```

## Authentication

The applet supports four authentication modes.

### Automatic

The applet attempts authentication in this order:

1. Hashed password, when configured
2. SafeCookie
3. Cookie

### Password

Uses the Tor `HASHEDPASSWORD` authentication mechanism.

```text
AUTHENTICATE "password"
```

### Cookie

Reads Tor's authentication cookie and sends it to the Control Port.

### SafeCookie

Implements Tor's SafeCookie authentication flow using:

* `AUTHCHALLENGE SAFECOOKIE`
* HMAC-SHA256
* Tor authentication cookies
* Client and server nonces

The SafeCookie implementation uses the system `openssl` command to calculate the HMAC.

## System Proxy

When **System Proxy** is enabled, the applet configures the GNOME proxy settings:

```text
org.gnome.system.proxy
org.gnome.system.proxy.socks
```

The SOCKS proxy is configured using the selected Tor host and SOCKS port.

For example:

```text
SOCKS Host: 127.0.0.1
SOCKS Port: 9050
```

Disabling the proxy changes the system proxy mode back to:

```text
none
```

> **Note:** Changing the system proxy affects applications that honor the GNOME system proxy settings. It does not guarantee that every application will route its traffic through Tor.

## Tor Status

The applet checks the Tor service using:

```bash
systemctl is-active tor
```

The panel icon changes depending on the current state:

```text
Tor enabled  → tor_on.png
Tor disabled → tor_off.png
```

If Tor is not installed, the applet disables the Tor switch and displays an error state.

## New Identity

The **New Identity** action connects to the Tor Control Port and authenticates using the configured authentication method.

It then sends:

```text
SIGNAL NEWNYM
```

Afterward, the applet polls Tor's bootstrap status and updates the displayed exit-node information.

> **Important:** `SIGNAL NEWNYM` requests a new Tor circuit, but Tor cannot guarantee that every existing connection will immediately use a different exit IP.

## Exit Node Information

The current exit node is queried through Tor's SOCKS proxy using:

```bash
curl \
  --proxy socks5h://127.0.0.1:9050 \
  ip-api.com/json/
```

The applet displays:

```text
Exit Country : Germany
Exit City    : Berlin
Exit IP      : xxx.xxx.xxx.xxx
```

The `socks5h` protocol is used so that hostname resolution is performed through the SOCKS proxy.

## IP Address Masking

Individual IPv4 octets can be hidden from the Cinnamon panel.

For example:

```text
Original:
185.220.101.42

Mask octets 1 and 4:

xxx.220.101.xxx
```

Available settings:

```text
mask-octet-1
mask-octet-2
mask-octet-3
mask-octet-4
```

This only masks the IP displayed by the applet. It does **not** change or anonymize the actual network address.

## Tor Connection Test

The **Test Tor Connection** action queries:

```text
https://check.torproject.org/api/ip
```

through the configured SOCKS proxy.

A successful result is displayed as:

```text
Test : Tor OK (xxx.xxx.xxx.xxx)
```

If the request succeeds but Tor reports that the connection is not using Tor:

```text
Test : Traffic is NOT using Tor
```

## Bootstrap Progress

When Tor starts or a new identity is requested, the applet queries:

```text
GETINFO status/bootstrap-phase
```

and extracts the Tor bootstrap percentage:

```text
PROGRESS=0
PROGRESS=25
PROGRESS=50
...
PROGRESS=100
```

The menu displays the progress while Tor establishes its circuits.

## Menu

The applet menu provides the following controls:

```text
- Tor Control -

Tor Status
System Proxy
Exit Country
Exit City
Exit IP Address

Tor Network
System Proxy

New Identity
Test Tor Connection
Test Status

Preferences
```

Individual menu elements can be hidden through the applet preferences.

## Configurable Interface Elements

The following interface options can be enabled or disabled:

```text
showHeader
showPrefs
showTest
showNewIdentity
showCountry
showCity
showIP
```

This allows the menu to be customized according to the user's needs.

## Security Considerations

This applet controls the local Tor service and Tor Control Port.

### Root privileges

Starting and stopping Tor uses:

```bash
pkexec systemctl start tor
pkexec systemctl stop tor
```

Therefore, the desktop environment may request administrator authentication.

### Tor control password

If password authentication is used, the configured control password is stored through Cinnamon's applet settings.

For better security, consider using Tor's **Cookie** or **SafeCookie** authentication when possible.

### IP information

The applet intentionally displays the current Tor exit IP and location. IP masking only affects the information shown in the Cinnamon menu and does not provide additional network anonymity.

## Troubleshooting

### Tor is shown as not installed

Check that Tor is available:

```bash
which tor
```

Then verify the service:

```bash
systemctl status tor
```

### Cannot connect to the Control Port

Check that Tor is listening:

```bash
ss -lntp | grep 9051
```

Verify the configured:

```text
Control Port
Tor Host
Authentication method
```

### SOCKS proxy does not work

Check the Tor SOCKS listener:

```bash
ss -lntp | grep 9050
```

Test it manually:

```bash
curl --proxy socks5h://127.0.0.1:9050 \
     https://check.torproject.org/api/ip
```

### SafeCookie authentication fails

Make sure the Tor authentication cookie exists and is readable by the user running Cinnamon.

The applet obtains the cookie location from:

```text
PROTOCOLINFO 1
```

and uses Tor's reported `COOKIEFILE`.

Also ensure the required tools are installed:

```bash
openssl
xxd
```

### Exit information is unavailable

Test the request manually:

```bash
curl --max-time 15 \
     --proxy socks5h://127.0.0.1:9050 \
     https://check.torproject.org/api/ip
```

If this fails, verify that Tor is running and that the SOCKS port is correct.

## Development

The main applet implementation is contained in:

```text
applet.js
```

The implementation uses Cinnamon's GJS APIs, including:

```javascript
imports.ui.applet
imports.ui.popupMenu
imports.ui.settings
imports.gi.GLib
imports.gi.Gio
imports.gi.St
imports.gi.Clutter
```

The code communicates with Tor directly through a `Gio.SocketClient` connection to the Tor Control Port.

## Project Structure

A typical project layout is:

```text
tor-control/
├── applet.js
├── metadata.json
├── settings-schema.json
├── tor_on.png
├── tor_off.png
└── README.md
```

## Disclaimer

This applet is a **Tor control interface**, not a replacement for the Tor software itself.

Using Tor does not automatically protect against every form of tracking, fingerprinting, application-level leaks, or incorrect system configuration.

Always verify that the applications and traffic you care about are actually using Tor.

## License

Add your preferred open-source license here.

For example:

```text
MIT License
```

See the `LICENSE` file for the complete license text.

## Contributing

Contributions, bug reports, and feature requests are welcome.

When submitting an issue, please include:

* Cinnamon version
* Linux distribution
* Tor version
* Relevant applet logs
* Steps to reproduce the problem

Please avoid posting Tor control passwords, authentication cookies, or other sensitive information in issues or pull requests.
