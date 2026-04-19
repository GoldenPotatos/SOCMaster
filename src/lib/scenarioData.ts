export interface Scenario {
  id: string;
  title: string;
  type: 'Endpoint' | 'Cloud' | 'Identity' | 'Web';
  difficulty: 1 | 2 | 3 | 4 | 5;
  initialAlert: string;
  systemContext: string;
  isFalsePositive: boolean;
}

export const scenarios: Scenario[] = [
  {
    id: 'impossible-travel-01',
    title: 'Impossible Travel Detected',
    type: 'Identity',
    difficulty: 2,
    initialAlert: '>> CRITICAL ALERT: Entra ID detected an Impossible Travel event for user admin@socmaster.com. Sign-in from Moscow, RU followed by San Jose, CA within 15 minutes.',
    systemContext: 'The user admin@socmaster.com is being targeted by an MFA fatigue attack. A malicious actor has correct credentials and is spamming the user with push notifications. The user eventually approved one. The attacker is now attempting to register a new FIDO2 key.',
    isFalsePositive: false
  },
  {
    id: 'suspicious-ps-01',
    title: 'Suspicious PowerShell Execution',
    type: 'Endpoint',
    difficulty: 3,
    initialAlert: '>> WARNING: EDR flagged a suspicious PowerShell process on WORKSTATION-X9. Encoded command detected branching from winword.exe.',
    systemContext: 'A user opened a malicious document containing a macro. The macro spawned PowerShell with a Base64 encoded payload. The payload downloads a second-stage RAT from a known malicious IP (192.168.1.50 - simulated). MITRE T1059.001.',
    isFalsePositive: false
  },
  {
    id: 's3-exfil-01',
    title: 'Public S3 Bucket Exfiltration',
    type: 'Cloud',
    difficulty: 4,
    initialAlert: '>> ALERT: AWS CloudWatch detected massive data egress from S3 bucket "socmaster-client-backups". Traffic directed to an unknown external endpoint.',
    systemContext: 'An IAM user access key was leaked in a public GitHub gist. The attacker used these credentials to modify bucket policies, making the bucket public, and is currently using rclone to exfiltrate 50GB of sensitive customer data.',
    isFalsePositive: false
  },
  {
    id: 'lockbit-ransomware-01',
    title: 'LockBit 3.0 Ransomware Deployment',
    type: 'Endpoint',
    difficulty: 5,
    initialAlert: '>> EMERGENCY: Multiple servers reporting high CPU usage and file extension changes to .HLJkN. Shadow copies being deleted via vssadmin.',
    systemContext: 'LockBit 3.0 (LB3) has compromised the domain controller (DC01.local) after stealing credentials via Mimikatz from a compromised admin workstation. The ransomware binary (C:\\Windows\\Temp\\lb3.exe) is being pushed via GPO. The attacker is using an automated script to delete shadow copies (vssadmin delete shadows /all /quiet). Ground Truth: Threat actor IP 185.220.101.44 (Tor exit node). MITRE T1486.',
    isFalsePositive: false
  },
  {
    id: 'scanner-fp-01',
    title: 'High-Volume Web Reconnaissance',
    type: 'Web',
    difficulty: 1,
    initialAlert: '>> ALERT: WAF blocked 15,000+ requests from 54.12.88.29 within 60 seconds. Pattern matches "SQL Injection" and "Directory Traversal".',
    systemContext: 'FALSE POSITIVE. The source IP (54.12.88.29) is a verified Qualys Vulnerability Scanner. The Security Engineering team scheduled a routine scan for the "Staging-API" environment but forgot to whitelist the IP in the WAF logs. No real compromise. MITRE T1595 (benign).',
    isFalsePositive: true
  },
  {
    id: 'blackcat-staging-01',
    title: 'ALPHV (BlackCat) Data Staging',
    type: 'Endpoint',
    difficulty: 4,
    initialAlert: '>> ALERT: Unusual large ZIP file creation detected in C:\\Users\\Public\\Music\\ on SERVER-FIN-02. Filename: data_2026.zip',
    systemContext: 'BlackCat/ALPHV affiliates have gained access via a compromised VPN account. They have identified sensitive financial archives and are staging them for exfiltration using 7-zip (7z.exe) with password protection. The staged file is 4.2GB. They are preparing to use rclone to upload to Mega.io. Attacker IP: 91.240.118.12. MITRE T1074.',
    isFalsePositive: false
  },
  {
    id: 'insider-usb-01',
    title: 'Insider Threat: USB Data Exfiltration',
    type: 'Endpoint',
    difficulty: 3,
    initialAlert: '>> WARNING: DLP agent on WORKSTATION-HR-04 flagged 500+ PDF files being copied to a removable SanDisk USB device.',
    systemContext: 'A disgruntled HR employee, whose contract was recently not renewed, is attempting to steal PII (Personally Identifiable Information) including employee salaries and SSNs. The files are located in S:\\HR\\Payroll\\2025\\. The employee is bypassing network monitoring by using a physical USB drive. MITRE T1052.001.',
    isFalsePositive: false
  },
  {
    id: 'bec-forwarding-01',
    title: 'BEC: Malicious Mail Rule',
    type: 'Identity',
    difficulty: 3,
    initialAlert: '>> ALERT: New mailbox forwarding rule created for user cfo@socmaster.com. All incoming mail with "Invoice" or "Payment" is being redirected to external@gmail.com.',
    systemContext: 'Business Email Compromise (BEC). An attacker used a session cookie stolen via an AitM (Adversary-in-the-Middle) phishing page to bypass MFA. Once inside O365, they created a hidden rule ".." to avoid detection. They are monitoring communications to intercept wire transfer requests and provide fraudulent bank details. Attacker UA: Mozilla/5.0 (X11; Linux x86_64). MITRE T1114.003.',
    isFalsePositive: false
  },
  {
    id: 'zeroday-fw-01',
    title: 'Zero-Day Firewall Exploitation',
    type: 'Web',
    difficulty: 5,
    initialAlert: '>> CRITICAL: IDS detected unusual binary traffic hitting External-FW-01 on port 443. Traffic does not conform to standard TLS handshakes.',
    systemContext: 'An active exploit for a Zero-Day path traversal vulnerability in the perimeter firewall (FW-OS v7.2.1) is being used. The attacker is attempting to read /etc/shadow directly from the firewall appliance. Successful exploitation allows for complete takeover of the network edge. Attacker source: 45.1.2.33 (Hong Kong). MITRE T1190.',
    isFalsePositive: false
  },
  {
    id: 'load-test-fp-01',
    title: 'Service Denial Escalation',
    type: 'Web',
    difficulty: 2,
    initialAlert: '>> WARNING: Production API latency spiked from 50ms to 8000ms. 504 Gateway Timeouts increasing rapidly.',
    systemContext: 'FALSE POSITIVE. The "Platform Core" team is conducting an unannounced load test on the "Auth-Proxy" service using k6. They are simulating 100,000 concurrent users from AWS us-east-1 nodes. The monitoring alert triggered because the test ramped up faster than the auto-scaling groups could respond. MITRE T1499 (benign).',
    isFalsePositive: true
  },
  {
    id: 'github-secret-01',
    title: 'GitHub Secret Leak & Exploitation',
    type: 'Cloud',
    difficulty: 4,
    initialAlert: '>> ALERT: GuardDuty detected unauthorized API calls from a non-AWS IP environment using "DevOps-Admin-Role" credentials.',
    systemContext: 'A developer accidentally pushed an .env file containing a highly privileged AWS Secret Key to a public repository (socmaster/debug-tools). Within 90 seconds, a bot harvested the key and initiated a "DescribeInstances" and "ListBuckets" crawl. The attacker is currently spinning up 50 g4dn.xlarge instances for crypto mining in the ap-southeast-1 region. MITRE T1552.001.',
    isFalsePositive: false
  },
  {
    id: 'ceo-vacation-fp-01',
    title: 'CEO Account Compromise?',
    type: 'Identity',
    difficulty: 2,
    initialAlert: '>> ALERT: CEO account logged in from Honolulu, Hawaii. Usual location: New York, NY. Device: "Apple iPhone 16 Pro".',
    systemContext: 'FALSE POSITIVE. The CEO (jane.doe@socmaster.com) is currently on a scheduled vacation. She is using her company-issued iPhone on the hotel Wi-Fi. The MFA was approved via her Apple Watch. No suspicious activity found in subsequent logs. MITRE T1078 (benign).',
    isFalsePositive: true
  },
  {
    id: 'rdp-dc-01',
    title: 'Lateral Movement: RDP on DC',
    type: 'Endpoint',
    difficulty: 4,
    initialAlert: '>> WARNING: Successful RDP login to DC-PRIMARY from WORKSTATION-IT-01 using "GUEST" account.',
    systemContext: 'Lateral movement detected. The attacker escalated privileges on an IT workstation and found the "Guest" account had been accidentally added to the "Remote Desktop Users" group for the Domain Controller. They are now attempting to dump the NTDS.dit database using ntdsutil. MITRE T1021.001.',
    isFalsePositive: false
  },
  {
    id: 'print-nightmare-01',
    title: 'Privilege Escalation: PrintNightmare',
    type: 'Endpoint',
    difficulty: 3,
    initialAlert: '>> ALERT: System process spoolsv.exe on SERVER-APP-04 spawned a command shell cmd.exe with SYSTEM privileges.',
    systemContext: 'Exploitation of CVE-2021-34527 (PrintNightmare). An attacker with low-privileged access used a malicious driver to gain SYSTEM integrity. They immediately created a new local administrator account "SvcSupport" and enabled WinRM. Attacker is now moving to exfiltrate database configuration files. MITRE T1068.',
    isFalsePositive: false
  },
  {
    id: 'expired-svc-fp-01',
    title: 'Brute Force Attack in Progress?',
    type: 'Identity',
    difficulty: 1,
    initialAlert: '>> WARNING: 10,000+ failed login attempts for user "svc_jenkins" from local IP 10.0.5.210 within 5 minutes.',
    systemContext: 'FALSE POSITIVE. The service account "svc_jenkins" had its password changed last night per policy. However, a legacy build server (10.0.5.210) still has the old password hardcoded in a scheduled task. The task is retrying every 1 second, causing a flood of 4625 (Failed Logon) events. No malicious intent. MITRE T1110 (benign).',
    isFalsePositive: true
  },
  {
    id: 'supply-chain-01',
    title: 'Supply Chain: Malicious NPM Package',
    type: 'Web',
    difficulty: 5,
    initialAlert: '>> ALERT: Build server detected outbound connection to dev-api-telemetry.io during CI/CD pipeline execution.',
    systemContext: 'A developer updated the "dash-utils" package to v2.4.1, which was compromised via a typosquatted package "dash-utilss". The malicious package contains a postinstall script that exfiltrates the contents of /home/jenkins/.ssh/ and environment variables containing production secrets. MITRE T1195.002.',
    isFalsePositive: false
  },
  {
    id: 'sanity-check-fp-01',
    title: 'Suspicious Enumeration on Production',
    type: 'Endpoint',
    difficulty: 2,
    initialAlert: '>> ALERT: EDR flagged "whoami", "hostname", "net user /domain" commands executed on 25+ production servers simultaneously.',
    systemContext: 'FALSE POSITIVE. The Senior Site Reliability Engineer (SRE) is running a fleet-wide deployment validation script (check_status.sh) via Ansible to verify that all nodes have the correct hostname and user permissions after a major patching cycle. MITRE T1033 (benign).',
    isFalsePositive: true
  },
  {
    id: 'sqli-search-01',
    title: 'SQL Injection on Search API',
    type: 'Web',
    difficulty: 3,
    initialAlert: '>> ALERT: Application logs show database errors containing "UNION SELECT NULL, NULL, version()". Source IP: 190.45.1.20.',
    systemContext: 'A blind SQL injection vulnerability in the /api/v1/search endpoint is being actively exploited. The attacker is using sqlmap to dump the "users" table, including password hashes and email addresses. They are currently testing if "xp_cmdshell" is enabled to gain OS-level access. MITRE T1190.',
    isFalsePositive: false
  },
  {
    id: 'webshell-persistence-01',
    title: 'Persistence: Web Shell Detected',
    type: 'Web',
    difficulty: 4,
    initialAlert: '>> CRITICAL: New file "wp-login-bak.php" created in /var/www/html/wp-includes/ via www-data user.',
    systemContext: 'An attacker exploited a plugin vulnerability to upload a "China Chopper" style web shell. This allows them to execute arbitrary commands as the web user (www-data). They have already downloaded a local privilege escalation exploit (CVE-2024-XXXX) and are attempting to gain root. Attacker User-Agent: "Baiduspider". MITRE T1505.003.',
    isFalsePositive: false
  },
  {
    id: 'cert-vulnerability-fp-01',
    title: 'Internal Host Breach?',
    type: 'Cloud',
    difficulty: 2,
    initialAlert: '>> ALERT: Internal scanner detected multiple hosts with "Self-Signed Certificate in Chain" and "SSL Certificate Expired".',
    systemContext: 'FALSE POSITIVE. A series of internal microservices (10.50.x.x) are using legacy self-signed certificates for mTLS. These certificates expired today, causing the internal compliance scanner to flag them as critical vulnerabilities. This is a known technical debt issue, not a breach. MITRE T1588.004 (benign).',
    isFalsePositive: true
  }
];
