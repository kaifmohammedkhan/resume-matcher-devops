pipeline {
    agent any

    environment {
        GITHUB_SERVER_URL = 'https://github.com'
        GITHUB_REPOSITORY = 'resume-matcher/resume-matcher'
        GITHUB_SHA        = "${env.GIT_COMMIT}"
        GITHUB_REF_NAME   = "${env.BRANCH_NAME}"
        GITHUB_RUN_NUMBER = "${env.BUILD_NUMBER}"
        GITHUB_RUN_ID     = "${env.BUILD_TAG}"
        REPOSITORY        = "${env.GITHUB_REPOSITORY}"
        BRANCH            = "${env.GITHUB_REF_NAME}"
        COMMIT            = "${env.GITHUB_SHA}"
        RUN_NUMBER        = "${env.BUILD_NUMBER}"
        RUN_ID            = "${env.BUILD_TAG}"
        ACTOR             = 'jenkins'
        
        // Credentials matched directly to your Jenkins Credential IDs
        EMAIL_USER        = credentials('EMAIL_USER')
        EMAIL_PASS        = credentials('EMAIL_PASS')
        SONAR_TOKEN       = credentials('SONAR_TOKEN')
        SONAR_HOST        = 'https://sonarcloud.io'
        SONAR_ORG         = 'my-organization'
        SONAR_PROJECT_KEY = 'my-project-key'
        GITHUB_CRED       = credentials('GITHUB_CRED')
    }

    stages {
        stage('CI Pipeline') {
            parallel {
                stage('OWASP Scan') {
                    steps {
                        sh 'chmod +x ci-owasp.sh && ./ci-owasp.sh'
                    }
                }
                stage('Unit Tests') {
                    steps {
                        sh 'chmod +x ci-test.sh && ./ci-test.sh'
                    }
                }
                stage('Security Checks') {
                    steps {
                        sh 'chmod +x ci-security-checks.sh && ./ci-security-checks.sh'
                    }
                }
            }
        }

        stage('CI Post-Test Analysis') {
            parallel {
                stage('SonarCloud') {
                    steps {
                        sh 'chmod +x ci-sonarcloud.sh && ./ci-sonarcloud.sh'
                    }
                }
                stage('Trivy Scan') {
                    steps {
                        sh 'chmod +x ci-trivy.sh && ./ci-trivy.sh'
                    }
                }
            }
        }

        stage('CI Email Summary') {
            steps {
                sh 'chmod +x ci-email.sh && ./ci-email.sh'
            }
        }

        stage('QA Cypress E2E') {
            steps {
                sh 'chmod +x qa-cypress.sh && ./qa-cypress.sh'
            }
        }

        stage('QA Load Testing') {
            parallel {
                stage('k6 Smoke Test') {
                    steps {
                        sh 'chmod +x qa-k6-smoke.sh && ./qa-k6-smoke.sh'
                    }
                }
                stage('k6 Load Test') {
                    steps {
                        sh 'chmod +x qa-k6-load.sh && ./qa-k6-load.sh'
                    }
                }
            }
        }

        stage('QA Summary Report') {
            steps {
                sh 'chmod +x qa-report.sh && ./qa-report.sh'
            }
        }
    }

    post {
        always {
            node('built-in') {
                archiveArtifacts artifacts: 'reports/**/*, **/*.html', allowEmptyArchive: true
            }
        }
    }
}
