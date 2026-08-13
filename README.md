# Tor Control Applet

A Cinnamon desktop applet that provides quick access to the Tor service, allowing you to manage Tor, configure the system SOCKS proxy, request a new Tor identity, and view information about your current Tor exit node directly from the panel.

<img width="340" height="384" alt="Screenshot from 2026-08-13 11-55-20" src="https://github.com/user-attachments/assets/177d4b23-0a0a-4406-9fa0-a0e1cc370b2a" />

## Features

- Toggle the Tor service on or off.
- Enable or disable the system SOCKS proxy.
- Optional automatic proxy configuration when Tor starts or stops.
- Request a **New Identity** (`SIGNAL NEWNYM`) from the Tor ControlPort.
- Test whether your connection is currently routed through the Tor network.
- Display Tor exit information:
  - Exit Country
  - Exit City
  - Exit IP Address
- Configure which exit information is displayed.
- Quick access to the applet's settings.

## Menu

The applet displays:

- **Tor Status**
- **System Proxy Status**
- **Exit Country**
- **Exit City**
- **Exit IP Address**
- **Tor Network** toggle
- **System Proxy** toggle
- **New Identity**
- **Test Tor Connection**
- **Preferences**

## Requirements

- Cinnamon Desktop
- Tor
- `curl`
- PolicyKit (`pkexec`)
- A configured Tor ControlPort

## Configuration

The applet can be configured from **Preferences**.

Available options include:

| Setting | Description |
|---------|-------------|
| Tor Host | Tor SOCKS/Control host (normally `127.0.0.1`) |
| SOCKS Port | Tor SOCKS proxy port (default `9050`) |
| Control Port | Tor ControlPort (default `9051`) |
| Refresh Interval | Refresh status automatically |
| Auto Proxy | Automatically enable/disable the system proxy with Tor |
| Show Country | Show the Tor exit country |
| Show City | Show the Tor exit city |
| Show IP | Show the Tor exit IP address |

## Using the Applet

### Start Tor

Enable the **Tor Network** switch.

If Auto Proxy is enabled, the system SOCKS proxy will also be configured automatically.

### Change Identity

Click **New Identity**.

The applet sends the `SIGNAL NEWNYM` command to the Tor ControlPort and refreshes the displayed exit information.

### Test Your Connection

Click **Test Tor Connection**.

The applet contacts the Tor Project API to verify that your traffic is using the Tor network and displays the current exit IP address.

## Exit Information

The applet retrieves the following information for the current Tor exit node:

- Country
- City
- IP Address

These values are obtained through the Tor SOCKS proxy, ensuring the lookup is performed over the Tor network.

## Permissions

Starting and stopping the Tor service requires administrator privileges.

The applet uses:

```text
pkexec systemctl start tor
pkexec systemctl stop tor
```

to control the Tor service.

## Notes

- The applet expects Tor to be installed and running as a system service.
- The Tor ControlPort must be enabled and accessible.
- The ControlPort password in the source should be replaced with your own authentication method before production use.

## Known Issues

- Some IP geolocation providers may return inaccurate or incomplete location information for Tor exit nodes.
- Newly requested identities may take a few seconds before updated exit information becomes available.

## License

This project is released under the MIT License unless otherwise stated.
