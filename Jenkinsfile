pipeline {
    agent any

    environment {
        EMAIL_USER = credentials('EMAIL_USER')
        EMAIL_PASS = credentials('EMAIL_PASS')

        QA_EMAIL_TO = 'kaifkhanmohammed718@gmail.com'
        QA_EMAIL_CC = 'kaifkhanmohammed718@gmail.com'

        DOCKERHUB_USERNAME = 'kaifmohammedkhan123'
        DOCKERHUB_TOKEN = credentials('DOCKERHUB_TOKEN')

        // Dedicated Jenkins credential for GitHub Container Registry.
        GHCR_TOKEN = credentials('GHCR_TOKEN')

        GITHUB_REPOSITORY = 'kaifmohammedkhan/resume-matcher-devops'
        GITHUB_WORKFLOW = 'Build and Push to GHCR and Docker Hub'
        GITHUB_REF_NAME = 'main'
        GITHUB_ACTOR = 'kaifmohammedkhan'
    }

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)

        buildDiscarder(logRotator(
            numToKeepStr: '20',
            artifactNumToKeepStr: '20'
        ))
    }

    stages {

        // ============================================================
        // STAGE 1: BUILD AND PUSH
        // ============================================================

        stage('Build & Push') {
            agent { label 'gha-runner' }

            stages {

                stage('Checkout repository') {
                    steps {
                        checkout scm
                    }
                }

                stage('Initialize GitHub metadata') {
                    steps {
                        script {
                            env.GITHUB_SHA = sh(
                                script: 'git rev-parse HEAD',
                                returnStdout: true
                            ).trim()

                            env.GITHUB_REF_NAME = sh(
                                script: 'git rev-parse --abbrev-ref HEAD',
                                returnStdout: true
                            ).trim()

                            env.GITHUB_RUN_NUMBER = env.BUILD_NUMBER

                            env.GITHUB_ACTOR = 'kaifmohammedkhan'

                            env.IMAGE_TAGS =
                                "ghcr.io/${env.GITHUB_REPOSITORY}:latest\n" +
                                "ghcr.io/${env.GITHUB_REPOSITORY}:sha-${env.GITHUB_SHA.take(7)}\n" +
                                "${env.DOCKERHUB_USERNAME}/resume-matcher-devops:latest\n" +
                                "${env.DOCKERHUB_USERNAME}/resume-matcher-devops:sha-${env.GITHUB_SHA.take(7)}"
                        }
                    }
                }

                stage('Set up QEMU') {
                    steps {
                        sh '''
                            set -e
                            docker run --privileged --rm tonistiigi/binfmt --install all
                        '''
                    }
                }

                stage('Set up Docker Buildx') {
                    steps {
                        sh '''
                            set -e

                            docker buildx inspect resume-matcher-builder >/dev/null 2>&1 || \
                                docker buildx create \
                                    --name resume-matcher-builder \
                                    --driver docker-container \
                                    --use

                            docker buildx use resume-matcher-builder
                            docker buildx inspect --bootstrap
                        '''
                    }
                }

                stage('Log in to GitHub Container Registry') {
                    steps {
                        sh '''
                            set -e

                            echo "$GHCR_TOKEN" | docker login ghcr.io \
                                --username "$GITHUB_ACTOR" \
                                --password-stdin
                        '''
                    }
                }

                stage('Log in to Docker Hub') {
                    steps {
                        sh '''
                            set -e

                            echo "$DOCKERHUB_TOKEN" | docker login \
                                --username "$DOCKERHUB_USERNAME" \
                                --password-stdin
                        '''
                    }
                }

                stage('Extract metadata (tags, labels) for Docker') {
                    steps {
                        sh '''
                            set -e

                            mkdir -p reports/docker

                            export OCI_CREATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
                            export OCI_REVISION="$GITHUB_SHA"
                            export OCI_SOURCE="https://github.com/$GITHUB_REPOSITORY"

                            GITHUB_SHORT_SHA="$(printf '%.7s' "$GITHUB_SHA")"

                            export OCI_VERSION="sha-$GITHUB_SHORT_SHA"

                            cat > reports/docker/docker-labels.env <<EOF
OCI_CREATED=$OCI_CREATED
OCI_REVISION=$OCI_REVISION
OCI_SOURCE=$OCI_SOURCE
OCI_VERSION=$OCI_VERSION
GITHUB_SHORT_SHA=$GITHUB_SHORT_SHA
EOF
                        '''
                    }
                }

                stage('Build and push Docker image') {
                    steps {
                        sh '''
                            set -e

                            . reports/docker/docker-labels.env

                            GITHUB_SHORT_SHA="$(printf '%.7s' "$GITHUB_SHA")"

                            docker buildx build \
                                --platform linux/amd64,linux/arm64 \
                                --push \
                                --metadata-file reports/docker/build-metadata.json \
                                --label "org.opencontainers.image.created=$OCI_CREATED" \
                                --label "org.opencontainers.image.revision=$OCI_REVISION" \
                                --label "org.opencontainers.image.source=$OCI_SOURCE" \
                                --label "org.opencontainers.image.version=$OCI_VERSION" \
                                -t "ghcr.io/$GITHUB_REPOSITORY:latest" \
                                -t "ghcr.io/$GITHUB_REPOSITORY:sha-$GITHUB_SHORT_SHA" \
                                -t "$DOCKERHUB_USERNAME/resume-matcher-devops:latest" \
                                -t "$DOCKERHUB_USERNAME/resume-matcher-devops:sha-$GITHUB_SHORT_SHA" \
                                .

                            test -s reports/docker/build-metadata.json

                            IMAGE_DIGEST="$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("reports/docker/build-metadata.json","utf8")); process.stdout.write(d["containerimage.digest"] || "");')"

                            if [ -z "$IMAGE_DIGEST" ]; then
                                IMAGE_DIGEST="$(docker buildx imagetools inspect \
                                    "ghcr.io/$GITHUB_REPOSITORY:sha-$GITHUB_SHORT_SHA" \
                                    --format '{{.Manifest.Digest}}')"
                            fi

                            test -n "$IMAGE_DIGEST"
                            test "$IMAGE_DIGEST" != "unknown"

                            case "$IMAGE_DIGEST" in
                                sha256:*) ;;
                                *)
                                    echo "ERROR: Invalid image digest: $IMAGE_DIGEST"
                                    exit 1
                                    ;;
                            esac

                            echo "IMAGE_DIGEST=$IMAGE_DIGEST" > reports/docker/image-digest.env
                        '''

                        script {
                            env.IMAGE_DIGEST = sh(
                                script: "sed -n 's/^IMAGE_DIGEST=//p' reports/docker/image-digest.env",
                                returnStdout: true
                            ).trim()
                        }
                    }
                }

                stage('Record immutable image digest') {
                    steps {
                        sh '''
                            set -e

                            test -n "$IMAGE_DIGEST"
                            test "$IMAGE_DIGEST" != "unknown"

                            mkdir -p reports/docker

                            {
                                echo "IMAGE_DIGEST=$IMAGE_DIGEST"
                                echo "IMAGE_TAGS<<EOF_TAGS"
                                printf '%s\\n' "$IMAGE_TAGS"
                                echo "EOF_TAGS"
                            } > reports/docker/image-metadata.txt

                            echo "=============================================="
                            echo "IMMUTABLE IMAGE DIGEST RECORDED"
                            echo "=============================================="
                            echo "Digest: $IMAGE_DIGEST"
                        '''
                    }
                }

                stage('Install Nodemailer') {
                    steps {
                        sh 'npm install nodemailer@9.0.3'
                    }
                }

                stage('Generate Docker Build & Push HTML Report') {
                    steps {
                        sh '''
                            set -e

                            . reports/docker/docker-labels.env

                            node --input-type=commonjs <<'NODE'
const fs = require("fs");

const repo = process.env.GITHUB_REPOSITORY || "N/A";
const branch = process.env.GITHUB_REF_NAME || "N/A";
const commit = process.env.GITHUB_SHA || "N/A";
const shortCommit = commit.substring(0, 7);
const runNumber = process.env.GITHUB_RUN_NUMBER || "N/A";
const workflow = process.env.GITHUB_WORKFLOW || "N/A";
const imageDigest = process.env.IMAGE_DIGEST || "N/A";
const dockerHubUsername = process.env.DOCKERHUB_USERNAME || "N/A";
const generatedAt = new Date().toISOString();

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Docker Build & Push Report</title>
    <style>
        body { background:#07111f; color:#f8fafc; font-family:Arial,sans-serif; padding:28px; margin:0; }
        .container { max-width:900px; margin:auto; }
        .panel { background:#0d1a2b; border:1px solid #263a56; border-radius:18px; padding:24px; margin-bottom:20px; }
        h1 { font-size:26px; margin:0 0 10px; }
        h2 { font-size:20px; margin:0 0 12px; }
        .status { font-weight:bold; color:#34d399; font-size:16px; margin-bottom:14px; }
        .meta { color:#a9b8cc; line-height:1.8; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; }
        .card { background:#102138; border:1px solid #263a56; border-radius:12px; padding:18px; }
        .label { color:#8fa4bd; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
        .value { margin-top:7px; font-size:18px; font-weight:bold; word-break:break-word; }
        .success { color:#34d399; }
        .small { color:#8fa4bd; font-size:12px; margin-top:7px; line-height:1.6; }
        .file { font-family:monospace; font-size:12px; word-break:break-all; }
        .digest { font-family:monospace; font-size:12px; word-break:break-all; background:#091525; padding:10px; border-radius:8px; margin-top:8px; }
    </style>
</head>
<body>
<div class="container">
    <div class="panel">
        <h1>Docker Build & Push Report</h1>
        <div class="status">✓ DOCKER IMAGE BUILD & PUSH COMPLETED SUCCESSFULLY</div>
        <div class="meta">
            Repository: ${escapeHtml(repo)}<br>
            Branch: ${escapeHtml(branch)}<br>
            Commit: ${escapeHtml(shortCommit)}<br>
            Workflow Run: #${escapeHtml(runNumber)}<br>
            Workflow: ${escapeHtml(workflow)}<br>
            Generated: ${escapeHtml(generatedAt)}
        </div>
    </div>

    <div class="panel">
        <h2>Registry Results</h2>
        <div class="grid">
            <div class="card">
                <div class="label">GitHub Container Registry</div>
                <div class="value success">✓ PUSHED</div>
                <div class="small">ghcr.io/${escapeHtml(repo)}:latest</div>
            </div>
            <div class="card">
                <div class="label">Docker Hub</div>
                <div class="value success">✓ PUSHED</div>
                <div class="small">${escapeHtml(dockerHubUsername)}/resume-matcher-devops:latest</div>
            </div>
        </div>
    </div>

    <div class="panel">
        <h2>Build Platforms</h2>
        <div class="grid">
            <div class="card"><div class="label">Platform</div><div class="value">linux/amd64</div></div>
            <div class="card"><div class="label">Platform</div><div class="value">linux/arm64</div></div>
        </div>
    </div>

    <div class="panel">
        <h2>Immutable Image Identity</h2>
        <div class="small">The digest below is the canonical identity of the multi-architecture image produced by this build.</div>
        <div class="digest">${escapeHtml(imageDigest)}</div>
    </div>
</div>
</body>
</html>`;

fs.mkdirSync("reports/docker", { recursive: true });
fs.writeFileSync("reports/docker/docker-build-push-report.html", html);
console.log("Docker Build & Push HTML report generated successfully.");
NODE
                        '''
                    }
                }

                stage('Verify Docker Build & Push Report') {
                    steps {
                        sh '''
                            set -e

                            test -s reports/docker/docker-build-push-report.html

                            echo "=============================================="
                            echo "DOCKER BUILD & PUSH REPORT VERIFIED"
                            echo "=============================================="

                            ls -lh reports/docker/docker-build-push-report.html
                        '''
                    }
                }

                stage('Upload Docker Build & Push Report') {
                    steps {
                        archiveArtifacts(
                            artifacts: 'reports/docker/docker-build-push-report.html,reports/docker/image-metadata.txt',
                            fingerprint: true
                        )
                    }
                }

                stage('Preserve Stage 1 Build Evidence') {
                    steps {
                        stash(
                            name: 'docker-build-push-stage1',
                            includes: 'reports/docker/docker-build-push-report.html,reports/docker/image-metadata.txt',
                            useDefaultExcludes: false
                        )
                    }
                }

                stage('Email Docker Build & Push Report') {
                    steps {
                        sh '''
                            set -e

                            test -s reports/docker/docker-build-push-report.html

                            node --input-type=commonjs <<'NODE'
const nodemailer = require("nodemailer");
const fs = require("fs");

const reportPath = "reports/docker/docker-build-push-report.html";

if (!fs.existsSync(reportPath) || fs.statSync(reportPath).size === 0) {
    throw new Error("Docker Build & Push HTML report does not exist or is empty.");
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const html = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;">
    <h2>Docker Build & Push Report</h2>
    <p style="color:#059669;font-weight:bold;">✓ Docker image build and push completed successfully</p>
    <p><strong>Repository:</strong> ${process.env.GITHUB_REPOSITORY || "N/A"}</p>
    <p><strong>Image Digest:</strong> ${process.env.IMAGE_DIGEST || "N/A"}</p>
    <p>The complete HTML build and push report is attached to this email.</p>
</div>`;

(async () => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.QA_EMAIL_TO,
        cc: process.env.QA_EMAIL_CC || "",
        subject: "Docker Build & Push Report",
        html,
        attachments: [{
            filename: "docker-build-push-report.html",
            path: reportPath
        }]
    });

    console.log("Docker Build & Push report email sent successfully.");
})().catch(error => {
    console.error(error);
    process.exit(1);
});
NODE
                        '''
                    }
                }
            }
        }

        // ============================================================
        // STAGE 2: SECURITY ENHANCEMENTS
        // ============================================================

        stage('Security Enhancements') {
            agent { label 'gha-runner' }

            stages {

                stage('Checkout repository') {
                    steps {
                        checkout scm
                    }
                }

                stage('Download Stage 1 Build Report') {
                    steps {
                        unstash 'docker-build-push-stage1'

                        sh '''
                            set -e

                            mkdir -p reports/docker-build

                            cp reports/docker/docker-build-push-report.html \
                                reports/docker-build/docker-build-push-report.html

                            cp reports/docker/image-metadata.txt \
                                reports/docker-build/image-metadata.txt
                        '''
                    }
                }

                stage('Verify Docker Build & Push Report') {
                    steps {
                        sh '''
                            set -e

                            test -s reports/docker-build/docker-build-push-report.html

                            echo "=============================================="
                            echo "STAGE 1 BUILD REPORT FOUND"
                            echo "=============================================="

                            ls -lh reports/docker-build/docker-build-push-report.html
                        '''
                    }
                }

                stage('Load immutable image digest') {
                    steps {
                        script {
                            env.IMAGE_DIGEST = sh(
                                script: '''
                                    set -e
                                    test -s reports/docker-build/image-metadata.txt
                                    sed -n 's/^IMAGE_DIGEST=//p' reports/docker-build/image-metadata.txt | head -n 1
                                ''',
                                returnStdout: true
                            ).trim()
                        }

                        sh '''
                            set -e

                            if [ -z "$IMAGE_DIGEST" ] || [ -z "$OTHER_VAR" ]; then
                                echo "ERROR: Immutable image digest was not recorded by Stage 1."
                                exit 1
                            fi

                            case "$IMAGE_DIGEST" in
                                sha256:*) ;;
                                *)
                                    echo "ERROR: Invalid image digest: $IMAGE_DIGEST"
                                    exit 1
                                    ;;
                            esac

                            echo "=============================================="
                            echo "IMMUTABLE IMAGE IDENTITY LOADED"
                            echo "=============================================="
                            echo "Digest: $IMAGE_DIGEST"
                        '''
                    }
                }

                stage('Install Cosign') {
                    steps {
                        sh '''
                            set -e

                            if ! command -v cosign >/dev/null 2>&1; then
                                COSIGN_VERSION="v3.1.3"

                                curl -sSfL \
                                    "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" \
                                    -o /tmp/cosign

                                chmod +x /tmp/cosign

                                if command -v sudo >/dev/null 2>&1; then
                                    sudo mv /tmp/cosign /usr/local/bin/cosign
                                else
                                    mkdir -p "$HOME/.local/bin"
                                    mv /tmp/cosign "$HOME/.local/bin/cosign"
                                    export PATH="$HOME/.local/bin:$PATH"
                                fi
                            fi
                        '''
                    }
                }

                stage('Verify Cosign installation') {
                    steps {
                        sh 'cosign version'
                    }
                }

                stage('Prepare Cosign Signing Key') {
                    steps {
                        withCredentials([
                            string(
                                credentialsId: 'COSIGN_PRIVATE_KEY',
                                variable: 'COSIGN_PRIVATE_KEY'
                            ),
                            string(
                                credentialsId: 'COSIGN_PASSPHRASE',
                                variable: 'COSIGN_PASSWORD'
                            )
                        ]) {
                            sh '''
                                set -eu

                                umask 077

                                # Jenkins Secret Text can preserve real newlines, but this
                                # normalization also handles pasted literal \\n sequences and CRLF.
                                printf '%s' "$COSIGN_PRIVATE_KEY" |
                                    sed 's/\\\\n/\
/g' |
                                    tr -d '\r' > cosign.key

                                chmod 600 cosign.key

                                if ! grep -Eq '^-----BEGIN .*PRIVATE KEY-----$' cosign.key; then
                                    echo "ERROR: COSIGN_PRIVATE_KEY is not a valid PEM private-key block."
                                    echo "Ensure the Jenkins credential contains the complete cosign.key text,"
                                    echo "including the BEGIN and END lines, with the actual line breaks."
                                    exit 1
                                fi

                                if ! grep -Eq '^-----END .*PRIVATE KEY-----$' cosign.key; then
                                    echo "ERROR: COSIGN_PRIVATE_KEY is missing the PEM END line."
                                    exit 1
                                fi

                                cosign public-key --key cosign.key > cosign.pub

                                test -s cosign.pub
                                chmod 644 cosign.pub

                                echo "Cosign signing and verification keys prepared."
                            '''
                        }
                    }
                }

                stage('Install Syft') {
                    steps {
                        sh '''
                            set -e

                            curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh \
                                | sh -s -- -b /usr/local/bin
                        '''
                    }
                }

                stage('Verify Syft installation') {
                    steps {
                        sh 'syft version'
                    }
                }

                stage('Log in to GitHub Container Registry') {
                    steps {
                        sh '''
                            set -e

                            echo "$GHCR_TOKEN" | docker login ghcr.io \
                                --username "$GITHUB_ACTOR" \
                                --password-stdin
                        '''
                    }
                }

                stage('Log in to Docker Hub') {
                    steps {
                        sh '''
                            set -e

                            echo "$DOCKERHUB_TOKEN" | docker login \
                                --username "$DOCKERHUB_USERNAME" \
                                --password-stdin
                        '''
                    }
                }

                stage('Prepare Docker security evidence directory') {
                    steps {
                        sh '''
                            set -e

                            mkdir -p reports/docker

                            echo "=============================================="
                            echo "Docker Security Evidence"
                            echo "=============================================="
                            echo "Repository : $GITHUB_REPOSITORY"
                            echo "Branch     : $GITHUB_REF_NAME"
                            echo "Commit     : $GITHUB_SHA"
                            echo "Run        : #$GITHUB_RUN_NUMBER"
                            echo "Image Digest: $IMAGE_DIGEST"
                            echo "=============================================="
                        '''
                    }
                }

                stage('Verify GHCR image exists') {
                    steps {
                        sh '''
                            set -e
                            docker manifest inspect "ghcr.io/$GITHUB_REPOSITORY@$IMAGE_DIGEST"
                        '''
                    }
                }

                stage('Verify Docker Hub image exists') {
                    steps {
                        sh '''
                            set -e
                            docker manifest inspect "$DOCKERHUB_USERNAME/resume-matcher-devops@$IMAGE_DIGEST"
                        '''
                    }
                }

                stage('Cosign Sign GHCR Image') {
                    steps {
                        withCredentials([
                            string(credentialsId: 'COSIGN_PRIVATE_KEY', variable: 'COSIGN_PRIVATE_KEY'),
                            string(credentialsId: 'COSIGN_PASSPHRASE', variable: 'COSIGN_PASSWORD')
                        ]) {
                            sh '''
                                set -euo pipefail
                                umask 077
                                trap 'rm -f cosign.key' EXIT

                                # Decode base64 string back to original multiline PEM format
                                echo "$COSIGN_PRIVATE_KEY" | base64 -d > cosign.key
                                chmod 600 cosign.key

                                cosign sign --yes --key cosign.key "ghcr.io/$GITHUB_REPOSITORY@$IMAGE_DIGEST"
                            '''
                        }
                    }
                }

                stage('Cosign Sign Docker Hub Image') {
                    steps {
                        withCredentials([
                            string(credentialsId: 'COSIGN_PRIVATE_KEY', variable: 'COSIGN_PRIVATE_KEY'),
                            string(credentialsId: 'COSIGN_PASSPHRASE', variable: 'COSIGN_PASSWORD')
                        ]) {
                            sh '''
                                set -euo pipefail
                                umask 077
                                trap 'rm -f cosign.key' EXIT

                                # Decode base64 string back to original multiline PEM format
                                echo "$COSIGN_PRIVATE_KEY" | base64 -d > cosign.key
                                chmod 600 cosign.key

                                # Verify key is valid before signing
                                cosign public-key --key cosign.key > /dev/null

                                # Execute signing using the resolved digest
                                cosign sign --yes --key cosign.key "${DOCKERHUB_USERNAME}/resume-matcher-devops@${IMAGE_DIGEST}"
                            '''
                        }
                    }
                }

                stage('Verify Cosign Signature — GHCR') {
                    steps {
                        sh '''
                            set -e

                            cosign verify \
                                --key cosign.pub \
                                --output json \
                                "ghcr.io/$GITHUB_REPOSITORY@$IMAGE_DIGEST" \
                                > reports/docker/cosign-ghcr-verify.json

                            test -s reports/docker/cosign-ghcr-verify.json

                            echo "=============================================="
                            echo "GHCR Cosign verification PASSED"
                            echo "=============================================="
                        '''
                    }
                }
            }
        }
    }
}
