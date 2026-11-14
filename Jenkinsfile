@Library('jenkins-shared-lib@main') _

pipeline {
    agent any

    environment {
        EMAIL_USER = credentials('EMAIL_USER')
        EMAIL_PASS = credentials('EMAIL_PASS')
    }

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '20'))
    }

    triggers {
        githubPush()
    }

    stages {
        stage('Parallel CI Jobs') {
            parallel {
                stage('CI Job') {
                    agent {
                        node {
                            label 'built-in'
                            customWorkspace 'workspace/resume-matcher-premain-ci'
                        }
                    }
                    steps {
                        runCi()
                    }
                }
            }
        }

        stage('Send CI Email Report') {
            steps {
                deleteDir()
                checkout scm
                sh 'sed -i "s/\r$//" scripts/*.sh && chmod +x scripts/*.sh'
                sh 'npm install'

                sh 'mkdir -p reports/security'
                unstash 'ci-reports-premain'

                sh '''
                    cp security-report.html reports/security/security-report.html 2>/dev/null || true
                    cp sonar-summary.html reports/sonar-summary.html 2>/dev/null || true
                    cp dependency-check-report.html reports/dependency-check-report.html 2>/dev/null || true

                    echo "Triggering CI email notification script..."
                    ./scripts/ci-email.sh
                '''
            }
        }

        stage('Continuous Deployment (CD) Pipeline') {
            when {
                branch 'main'
            }
            steps {
                script {
                    runCd()
                }
            }
        }

        stage('Send CD Security & Build Report Email') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    mkdir -p reports/docker
                    unstash 'cd-reports'

                    echo "Triggering CD Docker build & security email dispatch..."
                    # Add your custom CD email notification script or reuse node mailer here
                '''
            }
        }
    }
}
