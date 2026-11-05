# 1.0.0 桌面发布签名

桌面构建工作流始终生成 macOS 和 Windows 安装包。未配置签名凭据时，工作流只生成用于内部验证的 ad-hoc macOS 包和未签名 Windows 包；这些产物不能作为正式外部分发版本。

## macOS

在 GitHub Actions 仓库密钥中配置：

- `APPLE_CERTIFICATE`: Developer ID Application `.p12` 文件的 Base64 内容。
- `APPLE_CERTIFICATE_PASSWORD`: `.p12` 导出密码。
- `KEYCHAIN_PASSWORD`: CI 临时钥匙串密码。
- `APPLE_ID`: Apple 开发者账号。
- `APPLE_PASSWORD`: Apple 专用密码。
- `APPLE_TEAM_ID`: Apple Developer Team ID。

六项密钥全部存在时，CI 会导入 Developer ID 证书，执行 Tauri 签名与公证，并以 `REQUIRE_DISTRIBUTION_SIGNATURE=1` 拒绝 ad-hoc 签名或缺少 Team ID 的安装包。

## Windows

在 GitHub Actions 仓库密钥中配置：

- `WINDOWS_CERTIFICATE`: 代码签名 `.pfx` 文件的 Base64 内容。
- `WINDOWS_CERTIFICATE_PASSWORD`: `.pfx` 密码。

可选仓库变量：

- `WINDOWS_TIMESTAMP_URL`: 证书颁发机构提供的 RFC 3161 时间戳服务。未配置时使用 `http://timestamp.digicert.com`。

两项密钥均存在时，CI 会把证书导入当前用户证书库，将证书指纹传给 Tauri，并以 `REQUIRE_DISTRIBUTION_SIGNATURE=1` 要求 NSIS 和 MSI 安装包具有有效 Authenticode 签名。

## 发布边界

- 不要把 `.p12`、`.pfx`、密码、API 私钥或 Apple 专用密码提交到仓库。
- Pull Request 没有发布密钥时仍会执行完整测试和未签名安装包完整性校验。
- 只有严格签名校验通过的产物才能标记为正式分发版本。
