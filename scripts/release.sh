#!bash

echo "Removing last snapshot files ..."
rm latest.zip
rm -R latest
# rm -R docs
rm README.md

echo "Removing non-releaseable files ..."
find root/aether -type f -not -name '*.wasm' -not -name '*.js' -not -name '*.ts' -not -name '*.md' -delete || exit 1

echo "Taking new snapshot ..."
mv root/aether/prod latest || exit 1
# mv root/aether/docs docs || exit 1
mv root/aether/README.md . || exit 1

echo "Creating archive ..."
zip -r9 latest.zip latest || exit 1

echo "Pushing the new changes ..."
git add . || exit 1
git commit --amend --no-edit || exit 1
git push -f || exit 1

echo "Success!"