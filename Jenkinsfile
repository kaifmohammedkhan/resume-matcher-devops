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
        
        // Exact Credential IDs matching your Jenkins Dashboard
        EMAIL_USER        = credentials('EMAIL_USER')
        EMAIL_PASS        = credentials('EMAIL_PASS')
        SONAR_TOKEN       = credentials('SONAR_TOKEN')
        SONAR_HOST        = credentials('SONAR_HOST')
        SONAR_ORG         = credentials('SONAR_ORG')
        SONAR_PROJECT_KEY = credentials('SONAR_PROJECT_KEY')
        GITHUB_CRED       = credentials('GITHUB_CRED')
    }

    stages {
        stage('CI Pipeline') {
            parallel {
                stage('OWASP Scan') {
                    steps {
                        sh '''
                            sed -i 's/\r$//' ci-owasp.sh
                            chmod +x ci-owasp.sh
                            ./ci-owasp.sh
                        '''
                    }
                }
                stage('Unit Tests') {
                    steps {
                        sh '''
                            sed -i 's/\r$//' ci-test.sh
                            chmod +x ci-test.sh
                            ./ci-test.sh
                        '''
                    }
                }
                stage('Security Checks') {
                    steps {
                        sh '''
                            sed -i 's/\r$//' ci-security-checks.sh
                            chmod +x ci-security-checks.sh
                            ./ci-security-checks.sh
                        '''
                    }
                }
            }
        }

        stage('CI Post-Test Analysis') {
            parallel {
                stage('SonarCloud') {
                    steps {
                        sh '''
                            sed -i 's/\r$//' ci-sonarcloud.sh
                            chmod +x ci-sonarcloud.sh
                            ./ci-sonarcloud.sh
                        '''
                    }
                }
                stage('Trivy Scan') {
                    steps {
                        sh '''
                            sed -i 's/\r$//' ci-trivy.sh
                            chmod +x ci-trivy.sh
                            ./ci-trivy.sh
                        '''
                    }
                }
            }
        }

        stage('CI Email Summary') {
            steps {
                sh '''
                    sed -i 's/\r$//' ci-email.sh
                    chmod +x ci-email.sh
                    ./ci-email.sh
                '''
            }
        }

        stage('QA Cypress E2E') {
            steps {
                sh '''
                    sed -i 's/\r$//' qa-cypress.sh
                    chmod +x qa-cypress.sh
                    ./qa-cypress.sh
                '''
            }
        }

        stage('QA Load Testing') {
            parallel {
                stage('k6 Smoke Test') {
                    steps {
                        sh '''
                            sed -i 's/\r$//' qa-k6-smoke.sh
                            chmod +x qa-k6-smoke.sh
                            ./qa-k6-smoke.sh
                        '''
                    }
                }
                stage('k6 Load Test') {
                    steps {
                        sh '''
                            sed -i 's/\r$//' qa-k6-load.sh
                            chmod +x qa-k6-load.sh
                            ./qa-k6-load.sh
                        '''
                    }
                }
            }
        }

        stage('QA Summary Report') {
            steps {
                sh '''
                    sed -i 's/\r$//' qa-report.sh
                    chmod +x qa-report.sh
                    ./qa-report.sh
                '''
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
