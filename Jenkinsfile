pipeline {
    agent any

    environment {
        EMAIL_USER = credentials('EMAIL_USER')
        EMAIL_PASS = credentials('EMAIL_PASS')
    }

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)

        buildDiscarder(logRotator(
            numToKeepStr: '20',
            artifactNumToKeepStr: '20'
        ))
    }

    triggers {
        githubPush()
    }

    stages {
        stage('Parallel Jobs') {
            parallel {
                stage('CI Job') {
                    agent {
                        label 'gha-runner'
                    }

                    stages {
                        stage('Checkout Code') {
                            steps {
                                deleteDir()
                                checkout scm
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                sh 'sed -i "s/\r$//" scripts/*.sh'
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                sh 'chmod +x scripts/*.sh'
                            }
                        }

                        stage('Run Tests') {
                            steps {
                                sh './scripts/ci-test.sh'
                            }
                        }

                        stage('Setup Java 21') {
                            steps {
                                script {
                                    def jdkHome = tool(
                                        name: 'Java-21',
                                        type: 'hudson.model.JDK'
                                    )
                                    env.CI_JAVA_HOME = jdkHome
                                }

                                sh '''
                                    export JAVA_HOME="$CI_JAVA_HOME"
                                    export PATH="$JAVA_HOME/bin:$PATH"

                                    echo "Java configuration:"
                                    java -version
                                '''
                            }
                        }

                        stage('SonarCloud Analysis') {
                            steps {
                                withCredentials([
                                    string(credentialsId: 'SONAR_TOKEN', variable: 'SONAR_TOKEN'),
                                    string(credentialsId: 'SONAR_HOST', variable: 'SONAR_HOST'),
                                    string(credentialsId: 'SONAR_ORG', variable: 'SONAR_ORG'),
                                    string(credentialsId: 'SONAR_PROJECT_KEY', variable: 'SONAR_PROJECT_KEY')
                                ]) {
                                    sh '''
                                        export JAVA_HOME="$CI_JAVA_HOME"
                                        export PATH="$JAVA_HOME/bin:$PATH"

                                        export GITHUB_REF_NAME="pre-main"
                                        export BRANCH_NAME="pre-main"
                                        export GIT_BRANCH="origin/pre-main"

                                        ./scripts/ci-sonarcloud.sh \
                                          -Dsonar.branch.name=pre-main
                                    '''
                                }
                            }
                        }

                        stage('Download Trivy HTML Template') {
                            steps {
                                sh '''
                                    curl --proto '=https' --tlsv1.2 -sSLf \
                                    https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl \
                                    -o html.tpl
                                '''
                            }
                        }

                        stage('Run Trivy FS Scan') {
                            steps {
                                sh '''
                                    docker run --rm \
                                        -v "$PWD:/work" \
                                        -w /work \
                                        aquasec/trivy:latest \
                                        fs . \
                                        --format template \
                                        --template '@html.tpl' \
                                        -o trivy-fs-report.html \
                                        --ignore-unfixed \
                                        --vuln-type os,library
                                '''
                            }
                        }

                        stage('Build Local Image for Trivy Scan') {
                            steps {
                                sh 'docker build -t app-local:latest .'
                            }
                        }

                        stage('Run Trivy Image Scan') {
                            steps {
                                sh '''
                                    docker run --rm \
                                        -v /var/run/docker.sock:/var/run/docker.sock \
                                        -v "$PWD:/work" \
                                        -w /work \
                                        aquasec/trivy:latest \
                                        image app-local:latest \
                                        --format template \
                                        --template '@html.tpl' \
                                        -o trivy-img-report.html \
                                        --ignore-unfixed \
                                        --vuln-type os,library
                                '''
                            }
                        }

                        stage('Install & Run Gitleaks') {
                            steps {
                                withCredentials([
                                    string(credentialsId: 'GITHUB_TOKEN', variable: 'GITHUB_TOKEN')
                                ]) {
                                    sh '''
                                        docker run --rm \
                                            -v "$PWD:/repo" \
                                            zricethezav/gitleaks:latest \
                                            detect \
                                            --source /repo \
                                            --verbose || true
                                    '''
                                }
                            }
                        }

                        stage('Security Checks') {
                            steps {
                                sh './scripts/ci-security-checks.sh'
                            }
                        }

                        stage('Consolidate & Stash CI Reports') {
                            steps {
                                sh '''
                                    mkdir -p reports/security

                                    cp reports/security/security-report.html \
                                        ./security-report.html 2>/dev/null || true

                                    cp reports/sonar-summary.html \
                                        ./sonar-summary.html 2>/dev/null || true

                                    [ -f test-summary.html ] || \
                                        echo "<html><body><h1>Test Summary Missing</h1></body></html>" \
                                        > test-summary.html

                                    [ -f sonar-summary.html ] || \
                                        echo "<html><body><h1>Sonar Summary Missing</h1></body></html>" \
                                        > sonar-summary.html

                                    [ -f trivy-fs-report.html ] || \
                                        echo "<html><body><h1>Trivy FS Scan Missing</h1></body></html>" \
                                        > trivy-fs-report.html

                                    [ -f trivy-img-report.html ] || \
                                        echo "<html><body><h1>Trivy Image Scan Missing</h1></body></html>" \
                                        > trivy-img-report.html

                                    [ -f security-report.html ] || \
                                        echo "<html><body><h1>Security Report Missing</h1></body></html>" \
                                        > security-report.html
                                '''

                                archiveArtifacts(
                                    artifacts: '''
                                        test-summary.html,
                                        sonar-summary.html,
                                        trivy-fs-report.html,
                                        trivy-img-report.html,
                                        security-report.html
                                    ''',
                                    allowEmptyArchive: true
                                )

                                stash(
                                    name: 'ci-reports-premain',
                                    includes: '''
                                        test-summary.html,
                                        sonar-summary.html,
                                        trivy-fs-report.html,
                                        trivy-img-report.html,
                                        security-report.html
                                    '''
                                )
                            }
                        }
                    }
                }

                stage('OWASP Job') {
                    agent {
                        label 'gha-runner'
                    }

                    stages {
                        stage('Checkout Code') {
                            steps {
                                deleteDir()
                                checkout scm
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                sh 'sed -i "s/\r$//" scripts/*.sh'
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                sh 'chmod +x scripts/*.sh'
                            }
                        }

                        stage('Setup Java 21') {
                            steps {
                                script {
                                    def jdkHome = tool(
                                        name: 'Java-21',
                                        type: 'hudson.model.JDK'
                                    )
                                    env.OWASP_JAVA_HOME = jdkHome
                                }

                                sh '''
                                    export JAVA_HOME="$OWASP_JAVA_HOME"
                                    export PATH="$JAVA_HOME/bin:$PATH"

                                    echo "Java configuration:"
                                    java -version
                                '''
                            }
                        }

                        stage('OWASP Dependency Check') {
                            steps {
                                withCredentials([
                                    string(credentialsId: 'NVD_API_KEY', variable: 'NVD_API_KEY')
                                ]) {
                                    sh '''
                                        export JAVA_HOME="$OWASP_JAVA_HOME"
                                        export PATH="$JAVA_HOME/bin:$PATH"

                                        export JAVA_OPTS="-Xms1024m -Xmx4096m"
                                        export JVM_ARGS="-Xmx4g -XX:MaxRAMPercentage=75.0"

                                        ./scripts/ci-owasp.sh --purge
                                    '''
                                }
                            }
                        }

                        stage('Consolidate & Stash OWASP Report') {
                            steps {
                                sh '''
                                    cp reports/dependency-check-report.html \
                                        ./dependency-check-report.html 2>/dev/null || true

                                    [ -f dependency-check-report.html ] || \
                                        echo "<html><body><h1>OWASP Dependency Check Missing</h1></body></html>" \
                                        > dependency-check-report.html
                                '''

                                archiveArtifacts(
                                    artifacts: 'dependency-check-report.html',
                                    allowEmptyArchive: true
                                )

                                stash(
                                    name: 'owasp-report-premain',
                                    includes: 'dependency-check-report.html'
                                )
                            }
                        }
                    }
                }

                stage('QA Job') {
                    agent {
                        label 'gha-runner'
                    }

                    stages {
                        stage('Checkout Code') {
                            steps {
                                deleteDir()
                                checkout scm
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                sh 'sed -i "s/\r$//" scripts/*.sh'
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                sh 'chmod +x scripts/*.sh'
                            }
                        }
                    }
                }
            }
        }
    }
}
