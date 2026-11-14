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
        stage('Parallel Jobs') {
            parallel {
                stage('CI Job') {
                    agent {
                        node {
                            label 'built-in'
                            customWorkspace 'workspace/resume-matcher-premain-ci'
                        }
                    }
                    stages {
                        stage('Execute CI Pipeline') {
                            steps {
                                // Calls runCi.groovy from your shared library
                                runCi()
                            }
                        }
                    }
                }
            }
        }

        // ============================================================
        // CONSOLIDATE & SEND EMAIL REPORT
        // ============================================================
        stage('Send Email Report') {
            steps {
                deleteDir()
                checkout scm
                sh 'sed -i "s/\r$//" scripts/*.sh && chmod +x scripts/*.sh'
                sh 'npm install'

                unstash 'ci-reports-premain'

                sh '''
                    mkdir -p reports/security
                    cp security-report.html reports/security/security-report.html 2>/dev/null || true
                    cp sonar-summary.html reports/sonar-summary.html 2>/dev/null || true

                    ./scripts/ci-email.sh
                '''
            }
        }
    }
}
