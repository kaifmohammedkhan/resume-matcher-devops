pipeline {
    agent any

    environment {
        EMAIL_USER = credentials('EMAIL_USER')
        EMAIL_PASS = credentials('EMAIL_PASS')

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

                stage('Generate Docker Build & Push HTML Report') {
                    steps {
                        sh '''
                            node --input-type=commonjs <<'NODE'

const nodemailer = require("nodemailer");
const fs = require("fs");

const reportPath =
    "reports/docker/docker-build-push-report.html";

if (
    !fs.existsSync(reportPath) ||
    fs.statSync(reportPath).size === 0
) {
    throw new Error(
        "Docker Build & Push HTML report does not exist or is empty."
    );
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const html = `
<div
    style="
        font-family:Arial,sans-serif;
        max-width:700px;
        margin:auto;
        color:#1f2937;
    "
>
    <h2>
        Docker Build & Push Report
    </h2>

    <p
        style="
            color:#059669;
            font-weight:bold;
        "
    >
        ✓ Docker image build and push completed successfully
    </p>

    <hr>

    <p>
        <strong>GHCR:</strong>
        ✓ Image pushed successfully
    </p>

    <p>
        <strong>Docker Hub:</strong>
        ✓ Image pushed successfully
    </p>

    <p>
        <strong>Platforms:</strong>
        linux/amd64, linux/arm64
    </p>

    <p>
        The complete HTML build and push report
        is attached to this email.
    </p>
</div>
`;

(async () => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.QA_EMAIL_TO,
        cc: process.env.QA_EMAIL_CC || "",
        subject: "Docker Build & Push Report",
        html,
        attachments: [
            {
                filename: "docker-build-push-report.html",
                path: reportPath
            }
        ]
    });

    console.log(
        "Docker Build & Push report email sent successfully."
    );

})().catch(error => {
    console.error(error);
    process.exit(1);
});

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

                stage('Install Nodemailer') {
                    steps {
                        sh 'npm install nodemailer@9.0.3'
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

                            if [ -z "$IMAGE_DIGEST" ] || [ "$IMAGE_DIGEST" = "unknown" ]; then
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
                                COSIGN_VERSION="v4.1.2"

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
                        withEnv(['COSIGN_YES=true']) {
                            sh '''
                                set -e
                                cosign sign "ghcr.io/$GITHUB_REPOSITORY@$IMAGE_DIGEST"
                            '''
                        }
                    }
                }

                stage('Cosign Sign Docker Hub Image') {
                    steps {
                        withEnv(['COSIGN_YES=true']) {
                            sh '''
                                set -e
                                cosign sign "$DOCKERHUB_USERNAME/resume-matcher-devops@$IMAGE_DIGEST"
                            '''
                        }
                    }
                }

                stage('Verify Cosign Signature — GHCR') {
                    steps {
                        sh '''
                            set -e

                            cosign verify \
                                --certificate-identity-regexp="https://github.com/kaifmohammedkhan/resume-matcher-devops/.github/workflows/.*@refs/heads/main" \
                                --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
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

                stage('Verify Cosign Signature — Docker Hub') {
                    steps {
                        sh '''
                            set -e

                            cosign verify \
                                --certificate-identity-regexp="https://github.com/kaifmohammedkhan/resume-matcher-devops/.github/workflows/.*@refs/heads/main" \
                                --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
                                --output json \
                                "$DOCKERHUB_USERNAME/resume-matcher-devops@$IMAGE_DIGEST" \
                                > reports/docker/cosign-dockerhub-verify.json

                            test -s reports/docker/cosign-dockerhub-verify.json

                            echo "=============================================="
                            echo "Docker Hub Cosign verification PASSED"
                            echo "=============================================="
                        '''
                    }
                }

                stage('Generate GHCR SPDX SBOM') {
                    steps {
                        sh '''
                            set -e

                            syft "ghcr.io/$GITHUB_REPOSITORY@$IMAGE_DIGEST" \
                                -o spdx-json \
                                > reports/docker/sbom-ghcr.json

                            test -s reports/docker/sbom-ghcr.json

                            echo "GHCR SPDX SBOM generated successfully."
                        '''
                    }
                }

                stage('Generate Docker Hub SPDX SBOM') {
                    steps {
                        sh '''
                            set -e

                            syft "$DOCKERHUB_USERNAME/resume-matcher-devops@$IMAGE_DIGEST" \
                                -o spdx-json \
                                > reports/docker/sbom-dockerhub.json

                            test -s reports/docker/sbom-dockerhub.json

                            echo "Docker Hub SPDX SBOM generated successfully."
                        '''
                    }
                }

                stage('Verify SBOM files') {
                    steps {
                        sh '''
                            set -e

                            test -s reports/docker/sbom-ghcr.json
                            test -s reports/docker/sbom-dockerhub.json

                            echo "GHCR SPDX SBOM generated successfully."
                            echo "Docker Hub SPDX SBOM generated successfully."
                            echo ""
                            echo "Current evidence:"

                            ls -lh reports/docker/
                        '''
                    }
                }

                stage('Cosign Attest SPDX SBOM — GHCR') {
                    steps {
                        withEnv(['COSIGN_YES=true']) {
                            sh '''
                                set -e

                                cosign attest \
                                    --predicate reports/docker/sbom-ghcr.json \
                                    --type spdxjson \
                                    "ghcr.io/$GITHUB_REPOSITORY@$IMAGE_DIGEST"

                                echo "GHCR SPDX SBOM attestation created."
                            '''
                        }
                    }
                }

                stage('Cosign Attest SPDX SBOM — Docker Hub') {
                    steps {
                        withEnv(['COSIGN_YES=true']) {
                            sh '''
                                set -e

                                cosign attest \
                                    --predicate reports/docker/sbom-dockerhub.json \
                                    --type spdxjson \
                                    "$DOCKERHUB_USERNAME/resume-matcher-devops@$IMAGE_DIGEST"

                                echo "Docker Hub SPDX SBOM attestation created."
                            '''
                        }
                    }
                }

                stage('Verify SPDX SBOM Attestation — GHCR') {
                    steps {
                        sh '''
                            set -e

                            cosign verify-attestation \
                                --certificate-identity-regexp="https://github.com/kaifmohammedkhan/resume-matcher-devops/.github/workflows/.*@refs/heads/main" \
                                --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
                                --type spdxjson \
                                --output json \
                                "ghcr.io/$GITHUB_REPOSITORY@$IMAGE_DIGEST" \
                                > reports/docker/attestation-ghcr.json

                            test -s reports/docker/attestation-ghcr.json

                            echo "=============================================="
                            echo "GHCR SPDX attestation verification PASSED"
                            echo "=============================================="
                        '''
                    }
                }

                stage('Verify SPDX SBOM Attestation — DOCKER HUB') {
                    steps {
                        sh '''
                            set -e

                            cosign verify-attestation \
                                --certificate-identity-regexp="https://github.com/kaifmohammedkhan/resume-matcher-devops/.github/workflows/.*@refs/heads/main" \
                                --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
                                --type spdxjson \
                                --output json \
                                "$DOCKERHUB_USERNAME/resume-matcher-devops@$IMAGE_DIGEST" \
                                > reports/docker/attestation-dockerhub.json

                            test -s reports/docker/attestation-dockerhub.json

                            echo "=============================================="
                            echo "Docker Hub SPDX attestation verification PASSED"
                            echo "=============================================="
                        '''
                    }
                }

                stage('Verify all security evidence') {
                    steps {
                        sh '''
                            set -e

                            required_files=(
                                reports/docker/cosign-ghcr-verify.json
                                reports/docker/cosign-dockerhub-verify.json
                                reports/docker/sbom-ghcr.json
                                reports/docker/sbom-dockerhub.json
                                reports/docker/attestation-ghcr.json
                                reports/docker/attestation-dockerhub.json
                            )

                            for file in "${required_files[@]}"; do
                                if [ ! -s "$file" ]; then
                                    echo "ERROR: Required evidence file is missing or empty:"
                                    echo "$file"
                                    exit 1
                                fi

                                echo "Verified evidence file:"
                                echo "$file"
                            done

                            echo ""
                            echo "=============================================="
                            echo "ALL SECURITY EVIDENCE VERIFIED"
                            echo "=============================================="

                            ls -lh reports/docker/
                        '''
                    }
                }

                stage('Create raw security evidence ZIP') {
                    steps {
                        sh '''
                            set -e

                            cd reports/docker

                            zip -j docker-security-raw-evidence.zip \
                                cosign-ghcr-verify.json \
                                cosign-dockerhub-verify.json \
                                sbom-ghcr.json \
                                sbom-dockerhub.json \
                                attestation-ghcr.json \
                                attestation-dockerhub.json

                            cd ../..

                            test -s reports/docker/docker-security-raw-evidence.zip

                            echo ""
                            echo "=============================================="
                            echo "RAW SECURITY EVIDENCE ZIP CREATED"
                            echo "=============================================="
                        '''
                    }
                }

                stage('Generate Security Enhancements HTML Report') {
                    steps {
                        sh '''
                            node --input-type=commonjs <<'NODE'

const fs = require("fs");

const repo =
    process.env.GITHUB_REPOSITORY || "N/A";

const commit =
    process.env.GITHUB_SHA || "N/A";

const shortCommit =
    commit.substring(0, 7);

const branch =
    process.env.GITHUB_REF_NAME || "N/A";

const runNumber =
    process.env.GITHUB_RUN_NUMBER || "N/A";

const workflow =
    process.env.GITHUB_WORKFLOW || "N/A";

const generatedAt =
    new Date().toISOString();

const dockerHubUsername =
    process.env.DOCKERHUB_USERNAME || "N/A";

const imageDigest =
    process.env.IMAGE_DIGEST || "N/A";

const evidenceFiles = {
    ghcrSignature:
        "reports/docker/cosign-ghcr-verify.json",

    dockerHubSignature:
        "reports/docker/cosign-dockerhub-verify.json",

    ghcrSbom:
        "reports/docker/sbom-ghcr.json",

    dockerHubSbom:
        "reports/docker/sbom-dockerhub.json",

    ghcrAttestation:
        "reports/docker/attestation-ghcr.json",

    dockerHubAttestation:
        "reports/docker/attestation-dockerhub.json"
};

const evidence =
    Object.values(evidenceFiles);

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function readJson(file) {
    return JSON.parse(
        fs.readFileSync(file, "utf8")
    );
}

function fileSize(file) {
    const bytes =
        fs.statSync(file).size;

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        bytes / (1024 * 1024)
    ).toFixed(2)} MB`;
}

function sbomStats(file) {
    const sbom =
        readJson(file);

    return {
        packages:
            Array.isArray(sbom.packages)
                ? sbom.packages.length
                : 0,

        files:
            Array.isArray(sbom.files)
                ? sbom.files.length
                : 0,

        spdxVersion:
            sbom.spdxVersion || "SPDX JSON"
    };
}

function countEntries(file) {
    try {
        const data =
            readJson(file);

        if (Array.isArray(data)) {
            return data.length;
        }

        return 1;
    } catch {
        return 0;
    }
}

for (const file of evidence) {
    if (
        !fs.existsSync(file) ||
        fs.statSync(file).size === 0
    ) {
        throw new Error(
            `Required evidence file is missing or empty: ${file}`
        );
    }
}

const ghcrSbom =
    sbomStats(evidenceFiles.ghcrSbom);

const dockerHubSbom =
    sbomStats(evidenceFiles.dockerHubSbom);

const ghcrSignatureCount =
    countEntries(evidenceFiles.ghcrSignature);

const dockerHubSignatureCount =
    countEntries(evidenceFiles.dockerHubSignature);

const ghcrAttestationCount =
    countEntries(evidenceFiles.ghcrAttestation);

const dockerHubAttestationCount =
    countEntries(evidenceFiles.dockerHubAttestation);

const buildReportPath =
    "reports/docker-build/docker-build-push-report.html";

const buildReportAvailable =
    fs.existsSync(buildReportPath) &&
    fs.statSync(buildReportPath).size > 0;

const html = `<!doctype html>

<html lang="en">

<head>

    <meta charset="utf-8">

    <meta
        name="viewport"
        content="width=device-width,initial-scale=1"
    >

    <title>
        Docker Security Enhancements Report
    </title>

    <style>

        body {
            background:#07111f;
            color:#f8fafc;
            font-family:Arial,sans-serif;
            padding:28px;
            margin:0;
        }

        .container {
            max-width:1100px;
            margin:auto;
        }

        .panel {
            background:#0d1a2b;
            border:1px solid #263a56;
            border-radius:18px;
            padding:24px;
            margin-bottom:20px;
        }

        h1 {
            font-size:26px;
            margin:0 0 10px;
        }

        h2 {
            font-size:20px;
            margin:0 0 12px;
        }

        .status {
            font-weight:bold;
            color:#34d399;
            font-size:16px;
            margin-bottom:14px;
        }

        .meta {
            color:#a9b8cc;
            line-height:1.8;
        }

        .grid {
            display:grid;
            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(260px,1fr)
                );
            gap:14px;
        }

        .card {
            background:#102138;
            border:1px solid #263a56;
            border-radius:12px;
            padding:18px;
        }

        .label {
            color:#8fa4bd;
            font-size:12px;
            text-transform:uppercase;
            letter-spacing:.05em;
        }

        .value {
            margin-top:7px;
            font-size:18px;
            font-weight:bold;
            word-break:break-word;
        }

        .small {
            color:#8fa4bd;
            font-size:12px;
            margin-top:7px;
            line-height:1.6;
        }

        .success {
            color:#34d399;
        }

        .file {
            font-family:monospace;
            font-size:12px;
            word-break:break-all;
        }

        .digest {
            font-family:monospace;
            font-size:12px;
            word-break:break-all;
            background:#091525;
            padding:10px;
            border-radius:8px;
            margin-top:8px;
        }

        .notice {
            background:#0b2035;
            border-left:4px solid #60a5fa;
            padding:15px;
            border-radius:8px;
            line-height:1.6;
            color:#cbd5e1;
        }

    </style>

</head>

<body>

    <div class="container">

        <div class="panel">

            <h1>
                Docker Security Enhancements
            </h1>

            <div class="status">
                ✓ SECURITY VERIFICATION PASSED
            </div>

            <div class="meta">

                Repository:
                ${escapeHtml(repo)}
                <br>

                Branch:
                ${escapeHtml(branch)}
                <br>

                Commit:
                ${escapeHtml(shortCommit)}
                <br>

                Workflow Run:
                #${escapeHtml(runNumber)}
                <br>

                Workflow:
                ${escapeHtml(workflow)}
                <br>

                Generated:
                ${escapeHtml(generatedAt)}

            </div>

        </div>


        <div class="panel">

            <h2>
                Docker Build & Push
            </h2>

            <div class="grid">

                <div class="card">

                    <div class="label">
                        Build & Push Report
                    </div>

                    <div class="value success">
                        ${buildReportAvailable
                            ? "✓ AVAILABLE"
                            : "✗ NOT FOUND"}
                    </div>

                    <div class="small">

                        Stage 1 report:

                        <br>

                        <span class="file">
                            docker-build-push-report.html
                        </span>

                    </div>

                </div>

                <div class="card">

                    <div class="label">
                        GHCR
                    </div>

                    <div class="value success">
                        ✓ VERIFIED
                    </div>

                    <div class="small">

                        Image identity:
                        <br>

                        <span class="file">
                            ghcr.io/${escapeHtml(repo)}@${escapeHtml(imageDigest)}
                        </span>

                    </div>

                </div>

                <div class="card">

                    <div class="label">
                        Docker Hub
                    </div>

                    <div class="value success">
                        ✓ VERIFIED
                    </div>

                    <div class="small">

                        Image identity:
                        <br>

                        <span class="file">
                            ${escapeHtml(dockerHubUsername)}/resume-matcher-devops@${escapeHtml(imageDigest)}
                        </span>

                    </div>

                </div>

            </div>

        </div>


        <div class="panel">

            <h2>
                Immutable Image Identity
            </h2>

            <div class="notice">

                The security controls below are anchored to
                the exact image digest produced by Stage 1.

                <br><br>

                <strong>Digest:</strong>
                <span class="file">
                    ${escapeHtml(imageDigest)}
                </span>

                <br><br>

                This digest is the canonical production identity.
                The mutable <code>:latest</code> tag is retained
                only as a convenience alias and is not used for
                signing, verification, SBOM generation, or
                attestation.

            </div>

        </div>


        <div class="panel">

            <h2>
                Cosign Image Signing
            </h2>

            <div class="grid">

                <div class="card">

                    <div class="label">
                        GHCR
                    </div>

                    <div class="value success">
                        ✓ VERIFIED
                    </div>

                    <div class="small">

                        Verification records:
                        ${ghcrSignatureCount}

                        <br>

                        Evidence:
                        <span class="file">
                            cosign-ghcr-verify.json
                        </span>

                    </div>

                </div>

                <div class="card">

                    <div class="label">
                        Docker Hub
                    </div>

                    <div class="value success">
                        ✓ VERIFIED
                    </div>

                    <div class="small">

                        Verification records:
                        ${dockerHubSignatureCount}

                        <br>

                        Evidence:
                        <span class="file">
                            cosign-dockerhub-verify.json
                        </span>

                    </div>

                </div>

            </div>

        </div>


        <div class="panel">

            <h2>
                SPDX SBOM
            </h2>

            <div class="grid">

                <div class="card">

                    <div class="label">
                        GHCR
                    </div>

                    <div class="value success">
                        ✓ GENERATED
                    </div>

                    <div class="small">

                        SPDX Version:
                        ${escapeHtml(ghcrSbom.spdxVersion)}

                        <br>

                        Packages:
                        ${ghcrSbom.packages}

                        <br>

                        Files:
                        ${ghcrSbom.files}

                        <br>

                        Size:
                        ${escapeHtml(fileSize(evidenceFiles.ghcrSbom))}

                    </div>

                </div>

                <div class="card">

                    <div class="label">
                        Docker Hub
                    </div>

                    <div class="value success">
                        ✓ GENERATED
                    </div>

                    <div class="small">

                        SPDX Version:
                        ${escapeHtml(dockerHubSbom.spdxVersion)}

                        <br>

                        Packages:
                        ${dockerHubSbom.packages}

                        <br>

                        Files:
                        ${dockerHubSbom.files}

                        <br>

                        Size:
                        ${escapeHtml(fileSize(evidenceFiles.dockerHubSbom))}

                    </div>

                </div>

            </div>

        </div>


        <div class="panel">

            <h2>
                SBOM Attestation
            </h2>

            <div class="grid">

                <div class="card">

                    <div class="label">
                        GHCR
                    </div>

                    <div class="value success">
                        ✓ VERIFIED
                    </div>

                    <div class="small">

                        Predicate Type:
                        spdxjson

                        <br>

                        Verification records:
                        ${ghcrAttestationCount}

                    </div>

                </div>

                <div class="card">

                    <div class="label">
                        Docker Hub
                    </div>

                    <div class="value success">
                        ✓ VERIFIED
                    </div>

                    <div class="small">

                        Predicate Type:
                        spdxjson

                        <br>

                        Verification records:
                        ${dockerHubAttestationCount}

                    </div>

                </div>

            </div>

        </div>


        <div class="panel">

            <h2>
                Downloadable Raw Evidence
            </h2>

            <div class="notice">

                The complete machine-readable security
                evidence is preserved in the GitHub Actions
                artifact:

                <strong>
                    docker-security-evidence
                </strong>

                <br><br>

                The Docker Build & Push report from Stage 1
                is also preserved as:

                <strong>
                    docker-build-push-report
                </strong>

                <br><br>

                The raw security evidence ZIP contains
                the complete Cosign verification records,
                SPDX SBOMs, and SBOM attestation verification
                records.

                <br><br>

                All security evidence is associated with
                the immutable image digest shown above.

            </div>

        </div>

    </div>

</body>

</html>`;

fs.writeFileSync(
    "reports/docker/docker-security-report.html",
    html
);

console.log(
    "Docker security HTML report generated successfully."
);

NODE
                        '''
                    }
                }

                stage('Verify email attachment files') {
                    steps {
                        sh '''
                            set -e

                            test -s reports/docker/docker-security-report.html
                            test -s reports/docker/docker-security-raw-evidence.zip
                            test -s reports/docker-build/docker-build-push-report.html

                            echo "=============================================="
                            echo "EMAIL ATTACHMENTS VERIFIED"
                            echo "=============================================="

                            echo ""
                            echo "Docker Build & Push report:"
                            ls -lh reports/docker-build/docker-build-push-report.html

                            echo ""
                            echo "Docker Security report:"
                            ls -lh reports/docker/docker-security-report.html

                            echo ""
                            echo "Raw security evidence:"
                            ls -lh reports/docker/docker-security-raw-evidence.zip
                        '''
                    }
                }

                stage('Upload Docker Security Evidence') {
                    steps {
                        archiveArtifacts(
                            artifacts: 'reports/docker/**,reports/docker-build/**',
                            fingerprint: true
                        )
                    }
                }

                stage('Install Nodemailer') {
                    steps {
                        sh 'npm install nodemailer@9.0.3'
                    }
                }

                stage('Email Docker Security Report') {
                    steps {
                        sh '''
                            set -e
                            npm install nodemailer@9.0.3
                        '''
                    }
                }
            }
        }
    }
}
