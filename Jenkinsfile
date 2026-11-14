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
        stage('Determine Branch & Execute Workflow') {
            steps {
                deleteDir()
                checkout scm
                
                script {
                    // Robustly resolve the branch name even in detached HEAD state
                    def rawBranch = env.GIT_BRANCH ?: sh(
                        returnStdout: true, 
                        script: "git branch -r --contains HEAD | grep -v 'HEAD' | head -n 1"
                    ).trim()

                    // Clean up output (strip 'origin/' prefix and whitespace)
                    def currentBranch = rawBranch.replaceAll('^origin/', '').trim()
                    
                    echo "Resolved branch: '${currentBranch}'"

                    if (currentBranch == 'pre-main') {
                        echo "Executing CI Pipeline for pre-main..."
                        
                        // Run CI Job
                        node('built-in') {
                            ws('workspace/resume-matcher-premain-ci') {
                                runCi()
                            }
                        }

                        // Send CI Email Report
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

                    } else if (currentBranch == 'main') {
                        echo "Executing CD Pipeline for main..."
                        runCd()

                    } else {
                        error("Deployment halted: Branch '${currentBranch}' could not be matched to 'pre-main' or 'main'.")
                    }
                }
            }
        }
    }
}
