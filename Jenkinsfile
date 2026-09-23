pipeline {
    agent any

    environment {
        EMAIL_USER = credentials('EMAIL_USER')
        EMAIL_PASS = credentials('EMAIL_PASS')

        QA_EMAIL_TO = 'kaifkhanmohammed718@gmail.com'
        QA_EMAIL_CC = 'kaifkhanmohammed718@gmail.com'

        DOCKERHUB_USERNAME = 'kaifmohammedkhan123'
        DOCKERHUB_TOKEN = credentials('DOCKERHUB_TOKEN')

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

        stage('Checkout repository') {
            agent { label 'gha-runner' }
            steps {
                checkout scm
            }
        }

        stage('Initialize GitHub metadata') {
            agent { label 'gha-runner' }
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
            agent { label 'gha-runner' }
            steps {
                sh '''
                    set -e
                    docker run --privileged --rm tonistiigi/binfmt --install all
                '''
            }
        }

        stage('Set up Docker Buildx') {
            agent { label 'gha-runner' }
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
            agent { label 'gha-runner' }
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
            agent { label 'gha-runner' }
            steps {
                sh '''
                    set -e
                    echo "$DOCKERHUB_TOKEN" | docker login \
                        --username "$DOCKERHUB_USERNAME" \
                        --password-stdin
                '''
            }
        }

        // ... (all your other stages follow at the same level, properly indented)
    }
}
